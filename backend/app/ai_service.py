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
    SupportingDocItem,
    CrossSellItem,
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


def _clean_text(text: str) -> str:
    """Remove raw markdown bold asterisks so text renders cleanly."""
    return re.sub(r"\*\*([^*]+)\*\*", r"\1", text or "").strip()


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
    q_lower = (query or "").lower().strip()
    if not q_lower:
        return 85

    p_name = (product.name or "").lower().strip()
    p_brand = (product.brand or "").lower().strip()
    p_cat = (product.category or "").lower().strip()
    p_type = (product.type or "").lower().strip()
    p_sub = (product.sub_type or "").lower().strip()
    p_desc = (product.description or "").lower().strip()

    haystack = f"{p_name} {p_brand} {p_cat} {p_type} {p_sub} {p_desc}"
    primary_haystack = f"{p_name} {p_brand} {p_cat} {p_type} {p_sub}"

    bonus = 0
    if p_name and (p_name in q_lower or q_lower in p_name):
        bonus += 35
    if p_brand and p_brand in q_lower:
        bonus += 15
    if p_cat and p_cat in q_lower:
        bonus += 12
    if p_sub and p_sub in q_lower:
        bonus += 15

    prod_primary_tokens = _tokenize_multilingual(primary_haystack)
    reverse_hits = sum(1 for pt in prod_primary_tokens if len(pt) >= 3 and pt in q_lower)

    keywords = _tokenize_multilingual(q_lower)
    if not keywords:
        return min(98, 70 + bonus)

    hits = sum(1 for kw in keywords if kw in haystack)
    name_hits = sum(2 for kw in keywords if kw in primary_haystack)

    if hits == 0 and reverse_hits == 0 and bonus == 0:
        return 42

    hit_ratio = hits / max(1, len(keywords))
    name_ratio = name_hits / max(1, len(keywords) * 2)
    raw_score = (
        62
        + int(hit_ratio * 22)
        + int(name_ratio * 12)
        + min(12, bonus // 3)
        + min(6, reverse_hits * 2)
    )
    return min(99, max(42, raw_score))


def _filter_by_taxonomy(
    products: List[Product], req: AISuggestRequest
) -> List[Product]:
    filtered = products
    if req.category and req.category not in ("All Categories", "all", ""):
        filtered = [p for p in filtered if p.category == req.category]
    if req.type and req.type not in ("All Types", "all", ""):
        filtered = [p for p in filtered if p.type == req.type]
    if req.sub_type and req.sub_type not in ("All Sub Types", "all", ""):
        filtered = [p for p in filtered if p.sub_type == req.sub_type]
    return filtered


def _extract_product_docs_and_cross_sells(prod: Product):
    docs = [
        SupportingDocItem(
            title=d.get("title", "Validation Report"),
            doc_type=d.get("doc_type", "Validation Report"),
            summary=d.get("summary", ""),
            url=d.get("url", "#"),
        )
        for d in (prod.supporting_documents or [])
    ]
    cs = [
        CrossSellItem(
            product_name=c.get("product_name", "Complementary Product"),
            category=c.get("category", prod.category),
            reason=c.get("reason", ""),
        )
        for c in (prod.cross_sell_products or [])
    ]
    return docs, cs


def build_fallback_suggestion(
    req: AISuggestRequest,
    products: List[Product],
    model_label: str,
    inference_source: str = "instant_catalog_engine",
) -> AISuggestResponse:
    """
    Fast & accurate multilingual catalog recommendation engine.
    """
    filtered_products = _filter_by_taxonomy(products, req)
    scored = sorted(
        [(_score_product_match(req.query, p), p) for p in filtered_products],
        key=lambda x: x[0],
        reverse=True,
    )

    is_quick = req.search_mode == "quick"

    strong_matches = [(s, p) for s, p in scored if s >= 65]
    if is_quick:
        # In quick search, if query is empty return all filtered products; otherwise return strong matches or all scored
        if not req.query.strip():
            selected_scored = scored
        elif strong_matches:
            selected_scored = strong_matches
        else:
            selected_scored = scored
    else:
        selected_scored = strong_matches[:5] if strong_matches else scored[:5]

    suggested_products: List[SuggestedProductResult] = []
    supporting_docs: List[SupportingDocumentResult] = []
    cross_selling: List[CrossSellingResult] = []

    for score, prod in selected_scored:
        prod_docs, prod_cs = _extract_product_docs_and_cross_sells(prod)
        first_doc_title = (
            prod_docs[0].title if prod_docs else "มีเอกสาร Validation Report รองรับ"
        )
        first_cs_name = (
            prod_cs[0].product_name if prod_cs else "ชุดอุปกรณ์เสริมในสายงานเดียวกัน"
        )

        reasoning = f"ตัวเลือกที่ตรงความต้องการ ({score}% Match) • หมวด {prod.category} ({prod.sub_type})"
        benefits = [
            f"ประเภทสินค้า: {prod.category} — {prod.type} ({prod.sub_type})",
            f"เอกสารประกอบ (Supporting Docs): {first_doc_title}",
            f"แนะนำพ่วงขาย (Cross-selling): {first_cs_name}",
        ]

        suggested_products.append(
            SuggestedProductResult(
                product_id=prod.id,
                name=prod.name,
                brand=prod.brand,
                description=prod.description,
                category=prod.category,
                type=prod.type,
                sub_type=prod.sub_type,
                category_id=prod.category_id,
                type_id=prod.type_id,
                sub_type_id=prod.sub_type_id,
                image_url=prod.image_url,
                match_score=score,
                reasoning=reasoning,
                key_benefits=benefits,
                supporting_documents=prod_docs,
                cross_sell_products=prod_cs,
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

    top_name = suggested_products[0].name if suggested_products else "ไม่พบรายการสินค้า"
    top_score = suggested_products[0].match_score if suggested_products else 0
    query_display = req.query.strip() or "รายการสินค้าตามตัวกรองที่เลือก"

    if is_quick:
        summary = (
            f"พบสินค้าที่ตรงกับ \"{query_display}\" จำนวน {len(suggested_products)} รายการ "
            f"(อันดับ 1: {top_name} • {top_score}% Match)"
        )
        closing_note = ""
    else:
        summary = (
            f"เข้าใจแล้วครับ สำหรับความต้องการ \"{query_display}\" "
            f"ทางระบบได้วิเคราะห์สเปก เอกสาร Validation และสินค้าที่เกี่ยวข้องในแคตตาล็อก โดยรุ่นที่น่าพิจารณามีดังนี้"
        )
        doc_count = len(supporting_docs)
        cs_names = ", ".join(list({c.product_name for c in cross_selling[:3]})) or "อุปกรณ์เสริมในระบบ"
        closing_note = (
            f"เรื่องเอกสารประกอบและการต่อยอด (Supporting Documents & Cross-selling): "
            f"จากข้อมูลในระบบมีเอกสาร Validation Report และสิ่งพิมพ์อ้างอิงรองรับรวม {doc_count} รายการ "
            f"และแนะนำให้เสนอพ่วงคู่กับ {cs_names} เพื่อให้ครอบคลุมกระบวนการทำงานครบวงจรครับ (คลิกที่รายการสินค้าเพื่อดูรายละเอียดและเอกสารทั้งหมด)"
        )

    doc_limit = 6
    cs_limit = 6

    return AISuggestResponse(
        query=req.query,
        search_mode=req.search_mode,
        model_used="Quick Catalog Search" if is_quick else model_label,
        inference_source=inference_source,
        executive_summary=_clean_text(summary),
        closing_note=_clean_text(closing_note),
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
    type, sub_type, description, supporting_documents, and cross_sell_products stored in DB.
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
            prod_docs, prod_cs = _extract_product_docs_and_cross_sells(db_prod)
            synced.append(
                SuggestedProductResult(
                    product_id=db_prod.id,
                    name=db_prod.name,
                    brand=db_prod.brand,
                    description=db_prod.description,
                    category=db_prod.category,
                    type=db_prod.type,
                    sub_type=db_prod.sub_type,
                    category_id=db_prod.category_id,
                    type_id=db_prod.type_id,
                    sub_type_id=db_prod.sub_type_id,
                    image_url=db_prod.image_url,
                    match_score=max(final_score, det_score),
                    reasoning=_clean_text(
                        item.get("reasoning")
                        or f"ตัวเลือกที่ตรงความต้องการ • หมวด {db_prod.category} ({db_prod.sub_type})"
                    ),
                    key_benefits=[
                        _clean_text(b)
                        for b in (
                            item.get("key_benefits")
                            or [
                                f"ประเภท: {db_prod.category} — {db_prod.type} ({db_prod.sub_type})",
                                f"มีเอกสาร Validation Report รองรับ {len(prod_docs)} รายการ",
                                f"รองรับการพ่วงขาย (Cross-sell) {len(prod_cs)} รายการ",
                            ]
                        )
                    ],
                    supporting_documents=prod_docs,
                    cross_sell_products=prod_cs,
                )
            )

    for p in products:
        if p.id not in seen_ids:
            score = _score_product_match(query, p)
            if score >= 72:
                seen_ids.add(p.id)
                prod_docs, prod_cs = _extract_product_docs_and_cross_sells(p)
                synced.append(
                    SuggestedProductResult(
                        product_id=p.id,
                        name=p.name,
                        brand=p.brand,
                        description=p.description,
                        category=p.category,
                        type=p.type,
                        sub_type=p.sub_type,
                        category_id=p.category_id,
                        type_id=p.type_id,
                        sub_type_id=p.sub_type_id,
                        image_url=p.image_url,
                        match_score=score,
                        reasoning=f"ตัวเลือกที่ตรงความต้องการ ({score}% Match) • {p.category}",
                        key_benefits=[
                            f"หมวดหมู่: {p.category} • {p.sub_type}",
                            f"เอกสารอ้างอิง/Validation รองรับ {len(prod_docs)} รายการ",
                            f"แนะนำพ่วงขายคู่กับสินค้าในกลุ่มเดียวกัน {len(prod_cs)} รายการ",
                        ],
                        supporting_documents=prod_docs,
                        cross_sell_products=prod_cs,
                    )
                )

    synced.sort(key=lambda x: x.match_score, reverse=True)
    return synced


async def generate_product_suggestions(
    req: AISuggestRequest, products: List[Product]
) -> AISuggestResponse:
    """
    - Quick Search ('quick'): Uses the Instant Smart Catalog Engine for immediate results.
    - Detailed Search ('detailed'): Performs AI Inference and formats conversational output.
    """
    resolved_model = MODEL_MAP.get(req.model, req.model)
    if resolved_model == "Auto (default)":
        resolved_model = settings.DEFAULT_AI_MODEL

    filtered_products = _filter_by_taxonomy(products, req)

    if not filtered_products:
        return AISuggestResponse(
            query=req.query,
            search_mode=req.search_mode,
            model_used=resolved_model,
            inference_source="empty_catalog",
            executive_summary="ไม่พบสินค้าที่ตรงกับตัวกรองหรือคำค้นหาในขณะนี้ กรุณาลองเปลี่ยนหมวดหมู่หรือคำค้นหาใหม่ครับ",
            closing_note="",
            suggested_products=[],
            supporting_documents=[],
            cross_selling=[],
            created_at=datetime.now(timezone.utc),
        )

    if req.search_mode == "quick":
        return build_fallback_suggestion(
            req,
            filtered_products,
            "Quick Catalog Search",
            inference_source="instant_quick_search",
        )

    api_key = (settings.OPENROUTER_API_KEY or "").strip()
    if not api_key:
        return build_fallback_suggestion(
            req,
            filtered_products,
            resolved_model,
            inference_source="openrouter_compatible_engine",
        )

    ranked_products = sorted(
        filtered_products,
        key=lambda p: _score_product_match(req.query, p),
        reverse=True,
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
        "Analyze the customer's requirements against our Product Catalog JSON. "
        "Respond in natural, polite Thai (starting with 'เข้าใจแล้วครับ 😊 ...'). "
        "Do NOT use markdown bold asterisks (**). "
        "Return ONLY a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "executive_summary": "เข้าใจแล้วครับ 😊 ต้องการ... รุ่นที่น่าพิจารณามีดังนี้",\n'
        '  "closing_note": "เรื่องเอกสารประกอบและการต่อยอด: คำแนะนำเพิ่มเติมเรื่อง Validation Report และสินค้าพ่วงขาย",\n'
        '  "suggested_products": [\n'
        "    {\n"
        '      "product_id": 1,\n'
        '      "name": "Exact Product Name from catalog",\n'
        '      "match_score": 95,\n'
        '      "reasoning": "สโลแกนสั้นๆ 1 บรรทัดว่าทำไมรุ่นนี้ถึงตรงความต้องการ",\n'
        '      "key_benefits": ["จุดเด่นที่ 1", "จุดเด่นที่ 2", "จุดเด่นที่ 3"]\n'
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

    async with httpx.AsyncClient(timeout=8.0) as client:
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
                    parsed.get("suggested_products", []),
                    filtered_products,
                    req.query,
                )

                if not synced_products:
                    break

                fallback_res = build_fallback_suggestion(
                    req, filtered_products, candidate_model
                )

                return AISuggestResponse(
                    query=req.query,
                    search_mode=req.search_mode,
                    model_used=candidate_model,
                    inference_source="openrouter",
                    executive_summary=_clean_text(
                        parsed.get("executive_summary", fallback_res.executive_summary)
                    ),
                    closing_note=_clean_text(
                        parsed.get("closing_note", fallback_res.closing_note)
                    ),
                    suggested_products=synced_products[:5],
                    supporting_documents=fallback_res.supporting_documents[:6],
                    cross_selling=fallback_res.cross_selling[:6],
                    created_at=datetime.now(timezone.utc),
                )
            except Exception:
                continue

    return build_fallback_suggestion(
        req,
        filtered_products,
        resolved_model,
        inference_source="openrouter_compatible_engine",
    )
