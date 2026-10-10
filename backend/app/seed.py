from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models import User, Product, SearchHistory
from app.auth import hash_password


def seed_initial_data(db: Session) -> None:
    """Seed initial demo user, 3 catalog products (matching Figure 3), and 2 history items (matching Figure 2)."""
    if db.query(User).count() == 0:
        demo_user = User(
            username="admin",
            email="admin@fusion.co.th",
            hashed_password=hash_password("Admin@1234"),
            created_at=datetime.now(timezone.utc),
        )
        db.add(demo_user)
        db.commit()

    if db.query(Product).count() == 0:
        initial_products = [
            Product(
                name="DynaChrom system",
                brand="Thermo Scientific",
                description=(
                    "High-performance automated single-use chromatography system engineered for "
                    "scalable downstream bioprocessing, monoclonal antibody (mAb) purification, "
                    "and viral clearance workflows with integrated UV, pH, and conductivity sensors."
                ),
                image_url="https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&w=800&q=80",
                category="Chromatography Systems",
                type="Bioprocess Equipment",
                sub_type="Single-Use Automated Skid",
                supporting_documents=[
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
                cross_sell_products=[
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
            ),
            Product(
                name="MabSelect PrismA Prepacked Column",
                brand="Cytiva",
                description=(
                    "Next-generation Protein A affinity chromatography column featuring enhanced "
                    "alkaline stability (up to 1.0 M NaOH) and high dynamic binding capacity (>80 g/L) "
                    "for high-titer monoclonal and bispecific antibody purification."
                ),
                image_url="https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80",
                category="Chromatography Columns",
                type="Process Resins & Columns",
                sub_type="Protein A Affinity",
                supporting_documents=[
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
                cross_sell_products=[
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
            ),
            Product(
                name="Advantec PES 0.22 µm Sterilizing Capsule Filter",
                brand="Advantec",
                description=(
                    "Hydrophilic polyethersulfone (PES) dual-layer membrane capsule filter designed for "
                    "ultra-low protein binding, high flow rates, and sterile filtration of cell culture media, "
                    "chromatography buffers, and bulk drug substance."
                ),
                image_url="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80",
                category="Filtration & Membranes",
                type="Sterile Filtration",
                sub_type="PES Capsule Filter",
                supporting_documents=[
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
                cross_sell_products=[
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
            ),
        ]
        db.add_all(initial_products)
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
