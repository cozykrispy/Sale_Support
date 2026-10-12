from datetime import datetime, timezone
from typing import Tuple
from sqlalchemy.orm import Session
from app.models import (
    User,
    Product,
    SearchHistory,
    Category,
    ProductType,
    ProductSubType,
)
from app.auth import hash_password


def ensure_taxonomy_hierarchy(
    db: Session,
    category_name: str,
    type_name: str,
    sub_type_name: str,
) -> Tuple[Category, ProductType, ProductSubType]:
    """
    Ensure Category -> ProductType -> ProductSubType relational rows exist
    and return (category_obj, type_obj, sub_type_obj).
    """
    cat_clean = category_name.strip()
    type_clean = type_name.strip()
    sub_clean = sub_type_name.strip()

    cat_obj = db.query(Category).filter(Category.name == cat_clean).first()
    if not cat_obj:
        cat_obj = Category(name=cat_clean)
        db.add(cat_obj)
        db.flush()

    type_obj = (
        db.query(ProductType)
        .filter(
            ProductType.category_id == cat_obj.id,
            ProductType.name == type_clean,
        )
        .first()
    )
    if not type_obj:
        type_obj = ProductType(name=type_clean, category_id=cat_obj.id)
        db.add(type_obj)
        db.flush()

    sub_obj = (
        db.query(ProductSubType)
        .filter(
            ProductSubType.type_id == type_obj.id,
            ProductSubType.name == sub_clean,
        )
        .first()
    )
    if not sub_obj:
        sub_obj = ProductSubType(name=sub_clean, type_id=type_obj.id)
        db.add(sub_obj)
        db.flush()

    return cat_obj, type_obj, sub_obj


INITIAL_TAXONOMY_TREE = [
    ("Chromatography Systems", "Bioprocess Equipment", "Single-Use Automated Skid"),
    ("Chromatography Systems", "Bioprocess Equipment", "Stainless Steel Skid"),
    ("Chromatography Systems", "Lab Scale Equipment", "FPLC System"),
    ("Chromatography Columns", "Process Resins & Columns", "Protein A Affinity"),
    ("Chromatography Columns", "Process Resins & Columns", "Ion Exchange (IEX)"),
    ("Chromatography Columns", "Analytical Columns", "SEC UHPLC Column"),
    ("Filtration & Membranes", "Sterile Filtration", "PES Capsule Filter"),
    ("Filtration & Membranes", "Sterile Filtration", "PVDF Syringe Filter"),
    ("Filtration & Membranes", "Microbial Analysis & QC", "Gridded Membrane Filter"),
    ("Filtration & Membranes", "TFF Filtration", "PES Cassette"),
    ("Laboratory Equipment", "Centrifugation Skid", "Refrigerated Floor Centrifuge"),
    ("Laboratory Equipment", "Centrifugation Skid", "Benchtop Microcentrifuge"),
    ("Laboratory Equipment", "Incubation & Shakers", "CO2 Incubator"),
]


def seed_initial_data(db: Session) -> None:
    """Seed initial demo user, taxonomy hierarchy, 5 catalog products, and 2 history items."""
    if db.query(User).count() == 0:
        demo_user = User(
            username="admin",
            email="admin@fusion.co.th",
            hashed_password=hash_password("Admin@1234"),
            created_at=datetime.now(timezone.utc),
        )
        db.add(demo_user)
        db.commit()

    # Seed base Category -> Type -> SubType hierarchy
    for cat_name, type_name, sub_name in INITIAL_TAXONOMY_TREE:
        ensure_taxonomy_hierarchy(db, cat_name, type_name, sub_name)
    db.commit()

    if db.query(Product).count() == 0:
        initial_products_data = [
            {
                "name": "DynaChrom system",
                "brand": "Thermo Scientific",
                "description": (
                    "High-performance automated single-use chromatography system engineered for "
                    "scalable downstream bioprocessing, monoclonal antibody (mAb) purification, "
                    "and viral clearance workflows with integrated UV, pH, and conductivity sensors."
                ),
                "image_url": "https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&w=800&q=80",
                "category": "Chromatography Systems",
                "type": "Bioprocess Equipment",
                "sub_type": "Single-Use Automated Skid",
                "supporting_documents": [
                    {
                        "title": "DynaChrom Single-Use Flow Path Extractables & Leachables Validation Report",
                        "doc_type": "Validation Report",
                        "summary": "Comprehensive USP <665> and BPOG extractables validation data for GMP clinical and commercial manufacturing.",
                        "url": "https://example.com/docs/dynachrom-validation-report.pdf",
                    },
                    {
                        "title": "Application Note: High-Throughput Automated mAb Capture and Polishing on DynaChrom",
                        "doc_type": "Publication",
                        "summary": "Demonstrates 98.4% step yield and 40% faster turnaround time using single-use disposable flow kits.",
                        "url": "https://example.com/docs/dynachrom-mab-publication.pdf",
                    },
                ],
                "cross_sell_products": [
                    {
                        "product_name": "MabSelect PrismA Prepacked Column",
                        "category": "Chromatography Columns",
                        "reason": "Direct plug-and-play prepacked Protein A column validated for the DynaChrom single-use manifold.",
                    },
                    {
                        "product_name": "Advantec PES 0.22 µm Sterilizing Capsule Filter",
                        "category": "Filtration & Membranes",
                        "reason": "Recommended inline buffer and eluate sterile filtration unit directly downstream of DynaChrom.",
                    },
                ],
            },
            {
                "name": "MabSelect PrismA Prepacked Column",
                "brand": "Cytiva",
                "description": (
                    "Next-generation Protein A affinity chromatography column featuring enhanced "
                    "alkaline stability (up to 1.0 M NaOH) and high dynamic binding capacity (>80 g/L) "
                    "for high-titer monoclonal and bispecific antibody purification."
                ),
                "image_url": "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80",
                "category": "Chromatography Columns",
                "type": "Process Resins & Columns",
                "sub_type": "Protein A Affinity",
                "supporting_documents": [
                    {
                        "title": "Validation Report: 200-Cycle CIP Alkaline Stability & Ligand Leaching Study",
                        "doc_type": "Validation Report",
                        "summary": "Validates sanitizability with 0.5 M – 1.0 M NaOH and ultra-low residual Protein A leaching (<5 ppm).",
                        "url": "https://example.com/docs/mabselect-prisma-validation.pdf",
                    },
                    {
                        "title": "Peer-Reviewed Publication: Intensified Bioprocessing for Bispecific Antibodies",
                        "doc_type": "Publication",
                        "summary": "Published study comparing residence time vs. dynamic binding capacity in clinical biomanufacturing.",
                        "url": "https://example.com/docs/mabselect-publication.pdf",
                    },
                ],
                "cross_sell_products": [
                    {
                        "product_name": "DynaChrom system",
                        "category": "Chromatography Systems",
                        "reason": "Automated chromatography skid to drive precise gradient elution and inline UV monitoring.",
                    },
                    {
                        "product_name": "Residual Protein A ELISA Assay Kit",
                        "category": "Quality Control & Analytics",
                        "reason": "Essential QC release assay for quantifying leached Protein A in purified eluate pools.",
                    },
                ],
            },
            {
                "name": "Advantec PES 0.22 µm Sterilizing Capsule Filter",
                "brand": "Advantec",
                "description": (
                    "Hydrophilic polyethersulfone (PES) dual-layer membrane capsule filter designed for "
                    "ultra-low protein binding, high flow rates, and sterile filtration of cell culture media, "
                    "chromatography buffers, and bulk drug substance."
                ),
                "image_url": "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80",
                "category": "Filtration & Membranes",
                "type": "Sterile Filtration",
                "sub_type": "PES Capsule Filter",
                "supporting_documents": [
                    {
                        "title": "ASTM F838 Bacterial Retention & Pre-Use Integrity Validation Report",
                        "doc_type": "Validation Report",
                        "summary": "Confirms 100% retention of Brevundimonas diminuta (>10^7 CFU/cm²) and gamma irradiation stability.",
                        "url": "https://example.com/docs/advantec-pes-validation.pdf",
                    },
                    {
                        "title": "Technical Publication: Minimizing Yield Loss During Final Bulk Filtration of Biologics",
                        "doc_type": "Publication",
                        "summary": "Shows <0.3% non-specific protein adsorption across IgG1 and IgG4 formulations.",
                        "url": "https://example.com/docs/advantec-pes-publication.pdf",
                    },
                ],
                "cross_sell_products": [
                    {
                        "product_name": "DynaChrom system",
                        "category": "Chromatography Systems",
                        "reason": "Integrates seamlessly with DynaChrom outlet lines for closed-system sterile pool collection.",
                    },
                    {
                        "product_name": "Automated Filter Integrity Tester (Bubble Point & Forward Flow)",
                        "category": "Filtration Accessories",
                        "reason": "Required GMP instrument for pre- and post-use non-destructive filter integrity testing.",
                    },
                ],
            },
            {
                "name": "Cytiva Whatman Mixed Cellulose Ester (MCE) Membrane",
                "brand": "Cytiva",
                "description": (
                    "Standard biological and aqueous solution filtration membrane filter, 0.45 µm pore size, "
                    "ideal for microbial enumeration, particle testing, and routine laboratory clarification."
                ),
                "image_url": "https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80",
                "category": "Filtration & Membranes",
                "type": "Microbial Analysis & QC",
                "sub_type": "Gridded Membrane Filter",
                "supporting_documents": [
                    {
                        "title": "Whatman MCE Membrane Filtration Certificate of Analysis & Pore Size Consistency",
                        "doc_type": "Validation Report",
                        "summary": "Lot-to-lot consistency validation and recovery rate verification for aqueous bioburden monitoring.",
                        "url": "https://example.com/docs/whatman-mce-validation.pdf",
                    }
                ],
                "cross_sell_products": [
                    {
                        "product_name": "Advantec PES 0.22 µm Sterilizing Capsule Filter",
                        "category": "Filtration & Membranes",
                        "reason": "Upstream sterile filtration pairing before analytical particle sampling.",
                    }
                ],
            },
            {
                "name": "Thermo Scientific Sorvall Legend XFR Centrifuge",
                "brand": "Thermo Scientific",
                "description": (
                    "Floor-standing refrigerated high-speed centrifuge with Auto-Lock rotor exchange, "
                    "delivering exceptional capacity and ergonomic processing for cell harvesting and bioproduction."
                ),
                "image_url": "https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=800&q=80",
                "category": "Laboratory Equipment",
                "type": "Centrifugation Skid",
                "sub_type": "Refrigerated Floor Centrifuge",
                "supporting_documents": [
                    {
                        "title": "Sorvall Legend XFR IQ/OQ Qualification Protocol and Temperature Uniformity",
                        "doc_type": "Validation Report",
                        "summary": "Standard GMP installation & operational qualification validation guide.",
                        "url": "https://example.com/docs/sorvall-xfr-ioq.pdf",
                    }
                ],
                "cross_sell_products": [
                    {
                        "product_name": "DynaChrom system",
                        "category": "Chromatography Systems",
                        "reason": "Direct cell clarification output feeds directly into downstream DynaChrom capture skid.",
                    }
                ],
            },
        ]

        for item in initial_products_data:
            cat_obj, type_obj, sub_obj = ensure_taxonomy_hierarchy(
                db, item["category"], item["type"], item["sub_type"]
            )
            prod = Product(
                name=item["name"],
                brand=item["brand"],
                description=item["description"],
                image_url=item["image_url"],
                category_id=cat_obj.id,
                type_id=type_obj.id,
                sub_type_id=sub_obj.id,
                category=cat_obj.name,
                type=type_obj.name,
                sub_type=sub_obj.name,
                supporting_documents=item["supporting_documents"],
                cross_sell_products=item["cross_sell_products"],
            )
            db.add(prod)
        db.commit()
    else:
        # Backfill relational IDs for any existing products in sales_support.db
        existing_products = db.query(Product).all()
        for prod in existing_products:
            cat_obj, type_obj, sub_obj = ensure_taxonomy_hierarchy(
                db,
                prod.category or "General",
                prod.type or "Standard",
                prod.sub_type or "Standard",
            )
            prod.category_id = cat_obj.id
            prod.type_id = type_obj.id
            prod.sub_type_id = sub_obj.id
        db.commit()

    if db.query(SearchHistory).count() == 0:
        initial_history = [
            SearchHistory(
                user_id=1,
                query="Customer needs an automated single-use chromatography system for GMP monoclonal antibody purification with validation docs.",
                search_mode="detailed",
                model_used="Auto (default)",
                results={
                    "executive_summary": (
                        "Based on the customer's GMP monoclonal antibody (mAb) purification requirement, "
                        "the DynaChrom system paired with MabSelect PrismA Prepacked Columns provides a complete, "
                        "validated single-use downstream workflow."
                    )
                },
            ),
            SearchHistory(
                user_id=1,
                query="Looking for a low protein binding 0.22 micron sterile filter for chromatography buffers and drug substance.",
                search_mode="quick",
                model_used="Auto (default)",
                results={
                    "executive_summary": (
                        "Recommended the Advantec PES 0.22 µm Sterilizing Capsule Filter with ASTM F838 bacterial "
                        "retention validation report and cross-sell integrity testing kit."
                    )
                },
            ),
        ]
        db.add_all(initial_history)
        db.commit()
