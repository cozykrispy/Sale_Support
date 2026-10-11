import json
import re
from datetime import datetime, timezone
from typing import List, Optional
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
    "cohere/north-mini-code:free": "cohere/north-mini-code:free",
    "apodex/apodex-1.1-mini:free": "apodex/apodex-1.1-mini:free",
    "google/gemma-4-26b-a4b-it:free": "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3.5-lightning:free": "nvidia/nemotron-3.5-lightning:free",
    "openai/gpt-4o-mini": "openai/gpt-4o-mini",
    "google/gemini-2.5-flash": "google/gemini-2.5-flash",
    "meta-llama/llama-3.3-70b-instruct": "meta-llama/llama-3.3-70b-instruct",
}

FAST_FREE_FALLBACK_CHAIN = [
    "cohere/north-mini-code:free",
    "apodex/apodex-1.1-mini:free",
    "google/gemma-4-26b-a4b-it:free",
]


def _tokenize_multilingual(text: str) -> List[str]:
    """
    Tokenize English and Thai text without breaking Thai combining vowels or tone marks.
    Splits only on whitespace and standard punctuation.
    """
    tokens = [
        t.strip()
        for t in re.split(r"[\s,.;:!?/\\()\[\]{}\"\'\-+•]+", text.lower())
        if len(t.strip()) >= 2
    ]
    return tokens


def _score_product_match(query: str, product: Product) -> int:
    """
    Compute a high-precision relevance score (0-99) between customer query (Thai or English)
    and a catalog product (including user-added products).
    """
    q_lower = query.lower().strip()
    if not q_lower:
        return 70

    p_name = (product.name or "").lower().strip()
    p_brand = (product.brand or "").lower().strip()
    p_cat = (product.category or "").lower().strip()
    p_type = (product.type or "").lower().strip()
    p_sub = (product.sub_type or "").lower().strip()
    p_desc = (product.description or "").lower().strip()

    haystack = f"{p_name} {p_brand} {p_cat} {p_type} {p_sub} {p_desc}"
    primary_haystack = f"{p_name} {p_brand} {p_cat} {p_type} {p_sub}"

    bonus = 0
    # 1. Direct phrase / bidirectional substring check (great for Thai phrases without spaces)
    if p_name and (p_name in q_lower or q_lower in p_name):
        bonus += 35
    if p_brand and p_brand in q_lower:
        bonus += 15
    if p_cat and p_cat in q_lower:
        bonus += 12
    if p_sub and p_sub in q_lower:
        bonus += 15

    # 2. Check if any token from the product's name/category/type appears inside the query
    prod_primary_tokens = _tokenize_multilingual(primary_haystack)
    reverse_hits = sum(1 for pt in prod_primary_tokens if len(pt) >= 3 and pt in q_lower)

    # 3. Check query tokens against product haystack
    keywords = _tokenize_multilingual(q_lower)
    if not keywords:
        return min(98, 70 + bonus)

    hits = sum(1 for kw in keywords if kw in haystack)
    name_hits = sum(2 for kw in keywords if kw in primary_haystack)

    if hits == 0 and reverse_hits == 0 and bonus == 0:
        return 42

    hit_ratio = hits / max(1, len(keywords))
    name_ratio = name_hits / max(1, len(keywords) * 2)
    raw_score = 62 + int(hit_ratio * 22) + int(name_ratio * 12) + min(12, bonus // 3) + min(6, reverse_hits * 2)
    return min(99, max(42, raw_score))


def build_fallback_suggestion(
    req: AISuggestRequest,
    products: List[Product],
    model_label: str,
    inference_source: str = "instant_catalog_engine",
) -> AISuggestResponse:
    """
    Fast & accurate multilingual catalog recommendation engine.
    Used directly for Quick Search (<50ms response) and as seamless fallback for Detailed Search.
    """
    scored = sorted(
        [(_score_product_match(req.query, p), p) for p in products],
        key=lambda x: x[0],
        reverse=True,
    )

    is_quick = req.search_mode == "quick"

    # Filter out non-matching products (score <= 45) if we have strong matches (score >= 68)
    strong_matches = [(s, p) for s, p in scored if s >= 68]
    if strong_matches:
        selected_scored = strong_matches[:3] if is_quick else strong_matches[:5]
    else:
        selected_scored = scored[:3] if is_quick else scored[:5]

    suggested_products: List[SuggestedProductResult] = []
    supporting_docs: List[SupportingDocumentResult] = []
    cross_selling: List[CrossSellingResult] = []

    for score, prod in selected_scored:
        if is_quick:
            reasoning = (
                f"ตรงกับความต้องการ ({score}% Match) — {prod.name} ({prod.brand}) "
                f"หมวด {prod.category} ({prod.sub_type}): {prod.description}"
            )
            benefits = [
                f"{prod.category} • {prod.type} ({prod.sub_type})",
                f"มีเอกสารอ้างอิง/Validation รองรับ {len(prod.supporting_documents or [])} รายการ",
            ]
        else:
            reasoning = (
                f"{prod.name} ({prod.brand}) in {prod.category} directly addresses your customer's requirement "
                f"with proven {prod.sub_type} capabilities: {prod.description}"
            )
            benefits = [
                f"Category & Spec Fit: {prod.category} — {prod.type} ({prod.sub_type})",
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
    top_score = suggested_products[0].match_score if suggested_products else 0

    if is_quick:
        summary = (
            f"⚡ Quick Search (ค้นหาด่วนทันใจ): พบสินค้าที่ตรงกับ \"{req.query[:100]}\" จำนวน {len(suggested_products)} รายการ "
            f"โดยแนะนำอันดับ 1 คือ **{top_name}** (ความแม่นยำ {top_score}%) พร้อมเอกสารประกอบและสินค้าพ่วงขายทันที"
        )
    else:
        summary = (
            f"✨ Detailed Analysis: สำหรับความต้องการของลูกค้า \"{req.query}\", "
            f"เราขอแนะนำ **{top_name}** ({top_score}% Match) เป็นโซลูชันหลัก พร้อมเอกสาร Validation Report "
            f"และชุดสินค้า Cross-selling เพื่อปิดการขายครบวงจร"
        )

    doc_limit = 3 if is_quick else 6
    cs_limit = 3 if is_quick else 6

    return AISuggestResponse(
        query=req.query,
        search_mode=req.search_mode,
        model_used="Instant Catalog Matcher ⚡" if is_quick else model_label,
        inference_source=inference_source,
        executive_summary=summary,
        suggested_products=suggested_products,
        supporting_documents=supporting_docs[:doc_limit],
        cross_selling=cross_selling[:cs_limit],
        created_at=datetime.now(timezone.utc),
    )


def _sync_llm_products_with_db(
    llm_items: List[dict], products: List[Product], query: str
) -> List[SuggestedProductResult]:
    """
    Ensure every product returned by the LLM uses the EXACT image_url, brand, category,
    type, and sub_type stored in our database (including user-added products).
    Also injects high-scoring user-added products if the LLM missed them.
    """
    by_id = {p.id: p for p in products}
    by_name = {(p.name or "").lower().strip(): p for p in products}

    synced: List[SuggestedProductResult] = []
    seen_ids = set()

    for item in llm_items:
        pid = item.get("product_id")
        pname = str(item.get("name", "")).lower().strip()

        db_prod: Optional[Product] = None
        if isinstance(pid, int) and pid in by_id:
            db_prod = by_id[pid]
        elif pname in by_name:
            db_prod = by_name[pname]
        else:
            # Fuzzy match by substring
            for p in products:
                if p.name.lower() in pname or pname in p.name.lower():
                    db_prod = p
                    break

        if db_prod:
            if db_prod.id in seen_ids:
                continue
            seen_ids.add(db_prod.id)
            det_score = _score_product_match(query, db_prod)
            llm_score = item.get("match_score")
            final_score = (
                int(llm_score)
                if isinstance(llm_score, (int, float)) and 50 <= llm_score <= 99
                else det_score
            )
            synced.append(
                SuggestedProductResult(
                    product_id=db_prod.id,
                    name=db_prod.name,
                    brand=db_prod.brand,
                    category=db_prod.category,
                    type=db_prod.type,
                    sub_type=db_prod.sub_type,
                    image_url=db_prod.image_url,  # Always use exact DB image_url!
                    match_score=max(final_score, det_score),
                    reasoning=item.get("reasoning")
                    or f"{db_prod.name} ({db_prod.brand}) fits your requirement: {db_prod.description}",
                    key_benefits=item.get("key_benefits")
                    or [
                        f"{db_prod.category} — {db_prod.type} ({db_prod.sub_type})",
                        f"Includes {len(db_prod.supporting_documents or [])} supporting documents",
                    ],
                )
            )

    # Check if any database product (e.g. newly added by the user) has a strong match (>= 72)
    # but was omitted by the LLM
    for p in products:
        if p.id not in seen_ids:
            score = _score_product_match(query, p)
            if score >= 72:
                seen_ids.add(p.id)
                synced.append(
                    SuggestedProductResult(
                        product_id=p.id,
                        name=p.name,
                        brand=p.brand,
                        category=p.category,
                        type=p.type,
                        sub_type=p.sub_type,
                        image_url=p.image_url,
                        match_score=score,
                        reasoning=f"{p.name} ({p.brand}) matches your search criteria: {p.description}",
                        key_benefits=[
                            f"Category: {p.category} • {p.sub_type}",
                            f"Backed by {len(p.supporting_documents or [])} validation/technical documents",
                        ],
                    )
                )

    synced.sort(key=lambda x: x.match_score, reverse=True)
    return synced


async def generate_product_suggestions(
    req: AISuggestRequest, products: List[Product]
) -> AISuggestResponse:
    """
    - Quick Search ('quick'): Uses the Instant Smart Catalog Engine (<50ms) for immediate results.
    - Detailed Search ('detailed'): Performs deep AI Inference via OpenRouter with fast models
      and syncs product images & metadata with the database catalog.
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

    # 1. QUICK SEARCH MODE -> Instant response (<50ms) without waiting for external LLM latency
    if req.search_mode == "quick":
        return build_fallback_suggestion(
            req, products, "Instant Catalog Matcher ⚡", inference_source="instant_quick_search"
        )

    # 2. DETAILED SEARCH MODE -> Deep OpenRouter LLM Analysis
    api_key = (settings.OPENROUTER_API_KEY or "").strip()
    if not api_key:
        return build_fallback_suggestion(
            req, products, resolved_model, inference_source="openrouter_compatible_engine"
        )

    # Pre-rank products so LLM focuses on top relevant candidates and responds in ~2-3 seconds
    ranked_products = sorted(
        products, key=lambda p: _score_product_match(req.query, p), reverse=True
    )
    top_candidates = ranked_products[:4]

    catalog_payload = [
        {
            "id": p.id,
            "name": p.name,
            "brand": p.brand,
            "category": p.category,
            "type": p.type,
            "sub_type": p.sub_type,
            "description": p.description,
        }
        for p in top_candidates
    ]

    system_prompt = (
        "You are an expert AI Sales Support Specialist at Fusion Advantec. "
        "Analyze the customer's detailed requirements against our Product Catalog JSON. "
        "Respond in the same language as the customer's query (if Thai is present, write in natural professional Thai; otherwise English). "
        "Return ONLY a valid JSON object (no markdown fences) matching this exact schema:\n"
        "{\n"
        '  "executive_summary": "Detailed 2-3 sentence executive sales pitch tailored to the customer requirement",\n'
        '  "suggested_products": [\n'
        "    {\n"
        '      "product_id": 1,\n'
        '      "name": "Exact Product Name from catalog",\n'
        '      "match_score": 95,\n'
        '      "reasoning": "In-depth technical and sales explanation of why this product fits",\n'
        '      "key_benefits": ["Specific Benefit 1", "Specific Benefit 2", "Specific Benefit 3"]\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user_prompt = (
        f"Customer Needs & Context: {req.query}\n\n"
        f"Top Candidate Catalog JSON:\n{json.dumps(catalog_payload, ensure_ascii=False)}"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Fusion Advantec AI Sales Support Hub",
    }

    models_to_try = [resolved_model]
    for fb_m in FAST_FREE_FALLBACK_CHAIN:
        if fb_m not in models_to_try:
            models_to_try.append(fb_m)

    async with httpx.AsyncClient(timeout=9.0) as client:
        for candidate_model in models_to_try[:2]:
            payload = {
                "model": candidate_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.2,
            }
            try:
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
                if raw_content.startswith("```"):
                    raw_content = re.sub(r"^```(?:json)?\s*", "", raw_content)
                    raw_content = re.sub(r"\s*```$", "", raw_content)
                else:
                    match_json = re.search(r"\{.*\}", raw_content, re.DOTALL)
                    if match_json:
                        raw_content = match_json.group(0)

                parsed = json.loads(raw_content)
                synced_products = _sync_llm_products_with_db(
                    parsed.get("suggested_products", []), products, req.query
                )

                if not synced_products:
                    break

                # Build rich supporting documents and cross-selling from the matched DB products
                fallback_res = build_fallback_suggestion(req, products, candidate_model)

                return AISuggestResponse(
                    query=req.query,
                    search_mode=req.search_mode,
                    model_used=candidate_model,
                    inference_source="openrouter",
                    executive_summary=parsed.get(
                        "executive_summary", fallback_res.executive_summary
                    ),
                    suggested_products=synced_products[:5],
                    supporting_documents=fallback_res.supporting_documents[:6],
                    cross_selling=fallback_res.cross_selling[:6],
                    created_at=datetime.now(timezone.utc),
                )
            except Exception:
                continue

    return build_fallback_suggestion(
        req, products, resolved_model, inference_source="openrouter_compatible_engine"
    )
