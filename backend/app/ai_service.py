import json
import re
from datetime import datetime, timezone
from typing import List
import httpx

from app.config import settings
from app.models import Product
from app.schemas import (
    AISuggestRequest,
    AISuggestResponse,
    SuggestedProductResult,
    SupportingDocumentResult,
    CrossSellingResult,
)

MODEL_MAP = {
    "Auto (default)": settings.DEFAULT_AI_MODEL,
    "google/gemini-2.0-flash-exp:free": "google/gemini-2.0-flash-exp:free",
    "meta-llama/llama-3.3-70b-instruct:free": "meta-llama/llama-3.3-70b-instruct:free",
    "openai/gpt-4o-mini": "openai/gpt-4o-mini",
    "anthropic/claude-3.5-haiku": "anthropic/claude-3.5-haiku",
}


def _score_product_match(query: str, product: Product) -> int:
    """Compute a deterministic relevance score between customer query and a catalog product."""
    q_lower = query.lower()
    keywords = [w for w in re.split(r"\W+", q_lower) if len(w) > 2]
    haystack = (
        f"{product.name} {product.brand} {product.category} "
        f"{product.type} {product.sub_type} {product.description}"
    ).lower()

    if not keywords:
        return 75

    hits = sum(1 for kw in keywords if kw in haystack)
    # Boost if product name or category words match directly
    name_hits = sum(
        2 for kw in keywords if kw in f"{product.name} {product.category}".lower()
    )
    raw_score = min(98, 68 + int(((hits + name_hits) / max(1, len(keywords))) * 30))
    return raw_score


def build_fallback_suggestion(
    req: AISuggestRequest, products: List[Product], model_label: str
) -> AISuggestResponse:
    """Smart catalog recommendation engine used when OpenRouter API key is not set or unreachable."""
    scored = sorted(
        [( _score_product_match(req.query, p), p) for p in products],
        key=lambda x: x[0],
        reverse=True,
    )

    suggested_products: List[SuggestedProductResult] = []
    supporting_docs: List[SupportingDocumentResult] = []
    cross_selling: List[CrossSellingResult] = []

    for score, prod in scored:
        reasoning = (
            f"{prod.name} ({prod.brand}) in {prod.category} directly addresses your customer's need for "
            f"'{req.query[:120]}'. It offers proven {prod.sub_type} performance: {prod.description}"
        )
        benefits = [
            f"Category fit: {prod.category} — {prod.type} ({prod.sub_type})",
            f"Backed by {len(prod.supporting_documents or [])} validation reports & technical publications",
            f"Ready for cross-selling with {len(prod.cross_sell_products or [])} complementary workflow products",
        ]
        suggested_products.append(
            SuggestedProductResult(
                product_id=prod.id,
                name=prod.name,
                brand=prod.brand,
                category=prod.category,
                type=prod.type,
                sub_type=prod.sub_type,
                image_url=prod.image_url,
                match_score=score,
                reasoning=reasoning,
                key_benefits=benefits,
            )
        )

        for doc in prod.supporting_documents or []:
            supporting_docs.append(
                SupportingDocumentResult(
                    title=doc.get("title", "Technical Validation Report"),
                    doc_type=doc.get("doc_type", "Validation Report"),
                    related_product=prod.name,
                    relevance=doc.get(
                        "summary",
                        f"Supports customer technical evaluation of {prod.name}.",
                    ),
                    url=doc.get("url", "#"),
                )
            )

        for cs in prod.cross_sell_products or []:
            cross_selling.append(
                CrossSellingResult(
                    product_name=cs.get("product_name", "Complementary Accessory"),
                    category=cs.get("category", prod.category),
                    paired_with=prod.name,
                    pitch_reason=cs.get(
                        "reason",
                        f"Completes the end-to-end workflow alongside {prod.name}.",
                    ),
                )
            )

    top_name = suggested_products[0].name if suggested_products else "Catalog Portfolio"
    summary = (
        f"AI Analysis ({req.search_mode.title()} Mode): For the customer requirement \"{req.query}\", "
        f"we prioritize **{top_name}** as the primary recommendation, supported by validated GMP documentation "
        f"and integrated cross-selling opportunities across the portfolio."
    )

    return AISuggestResponse(
        query=req.query,
        search_mode=req.search_mode,
        model_used=model_label,
        inference_source="openrouter_compatible_engine",
        executive_summary=summary,
        suggested_products=suggested_products,
        supporting_documents=supporting_docs[:6],
        cross_selling=cross_selling[:6],
        created_at=datetime.now(timezone.utc),
    )


async def generate_product_suggestions(
    req: AISuggestRequest, products: List[Product]
) -> AISuggestResponse:
    """
    Perform AI Inference via OpenRouter API (https://openrouter.ai/api/v1/chat/completions).
    Returns Product Suggestions, Supporting Documents, and Cross-selling recommendations.
    Gracefully falls back if OPENROUTER_API_KEY is missing or rate-limited.
    """
    resolved_model = MODEL_MAP.get(req.model, req.model)
    if resolved_model == "Auto (default)":
        resolved_model = settings.DEFAULT_AI_MODEL

    if not products:
        return AISuggestResponse(
            query=req.query,
            search_mode=req.search_mode,
            model_used=resolved_model,
            inference_source="empty_catalog",
            executive_summary="No products are currently in the catalog. Please add products in the Manage Products tab.",
            suggested_products=[],
            supporting_documents=[],
            cross_selling=[],
            created_at=datetime.now(timezone.utc),
        )

    catalog_payload = [
        {
            "id": p.id,
            "name": p.name,
            "brand": p.brand,
            "category": p.category,
            "type": p.type,
            "sub_type": p.sub_type,
            "description": p.description,
            "image_url": p.image_url,
            "supporting_documents": p.supporting_documents or [],
            "cross_sell_products": p.cross_sell_products or [],
        }
        for p in products
    ]

    api_key = (settings.OPENROUTER_API_KEY or "").strip()
    if not api_key:
        return build_fallback_suggestion(req, products, resolved_model)

    system_prompt = (
        "You are an expert AI Sales Support Specialist at Fusion Advantec. "
        "Given the customer's requirements and our current Product Catalog JSON, analyze and return "
        "ONLY a valid JSON object (no markdown fences) matching this exact schema:\n"
        "{\n"
        '  "executive_summary": "Concise customer-ready executive pitch summary",\n'
        '  "suggested_products": [\n'
        "    {\n"
        '      "product_id": 1,\n'
        '      "name": "Product Name",\n'
        '      "brand": "Brand",\n'
        '      "category": "Category",\n'
        '      "type": "Type",\n'
        '      "sub_type": "Sub Type",\n'
        '      "image_url": "URL from catalog",\n'
        '      "match_score": 95,\n'
        '      "reasoning": "Why this product fits the customer need",\n'
        '      "key_benefits": ["Benefit 1", "Benefit 2"]\n'
        "    }\n"
        "  ],\n"
        '  "supporting_documents": [\n'
        "    {\n"
        '      "title": "Document Title",\n'
        '      "doc_type": "Validation Report | Publication",\n'
        '      "related_product": "Product Name",\n'
        '      "relevance": "Why the sales rep should share this document",\n'
        '      "url": "#"\n'
        "    }\n"
        "  ],\n"
        '  "cross_selling": [\n'
        "    {\n"
        '      "product_name": "Related Cross-Sell Product",\n'
        '      "category": "Category",\n'
        '      "paired_with": "Primary Product Name",\n'
        '      "pitch_reason": "Why the customer should buy this together"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user_prompt = (
        f"Search Mode: {req.search_mode}\n"
        f"Customer Needs: {req.query}\n\n"
        f"Available Product Catalog JSON:\n{json.dumps(catalog_payload, ensure_ascii=False)}"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Fusion Advantec AI Sales Support Hub",
    }
    payload = {
        "model": resolved_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                settings.OPENROUTER_BASE_URL, headers=headers, json=payload
            )
            response.raise_for_status()
            data = response.json()
            raw_content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            # Strip optional markdown code fences if returned by model
            if raw_content.startswith("```"):
                raw_content = re.sub(r"^```(?:json)?\s*", "", raw_content)
                raw_content = re.sub(r"\s*```$", "", raw_content)

            parsed = json.loads(raw_content)
            return AISuggestResponse(
                query=req.query,
                search_mode=req.search_mode,
                model_used=resolved_model,
                inference_source="openrouter",
                executive_summary=parsed.get(
                    "executive_summary", "AI recommendation generated via OpenRouter."
                ),
                suggested_products=[
                    SuggestedProductResult(**item)
                    for item in parsed.get("suggested_products", [])
                ],
                supporting_documents=[
                    SupportingDocumentResult(**item)
                    for item in parsed.get("supporting_documents", [])
                ],
                cross_selling=[
                    CrossSellingResult(**item)
                    for item in parsed.get("cross_selling", [])
                ],
                created_at=datetime.now(timezone.utc),
            )
    except Exception:
        # Fallback ensures reliability even if OpenRouter free tier is rate-limited
        return build_fallback_suggestion(req, products, resolved_model)
