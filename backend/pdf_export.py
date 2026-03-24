import io
import datetime as dt
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_portfolio_pdf(user_name, user_email, summary_data, assets, transactions):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    elements = []
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        name="TitleStyle",
        parent=styles['Heading1'],
        alignment=1, # Center
        spaceAfter=6,
        textColor=colors.HexColor("#0f172a")
    )
    
    subtitle_style = ParagraphStyle(
        name="Subtitle",
        parent=styles['Normal'],
        alignment=1, # Center
        textColor=colors.HexColor("#64748b"),
        fontSize=10
    )
    
    heading_style = ParagraphStyle(
        name="SectionHeading",
        parent=styles['Heading2'],
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=16,
        spaceAfter=10
    )
    
    # Header Section
    elements.append(Paragraph("SPAI Engine - Portfolio Statement", title_style))
    elements.append(Paragraph(f"<b>Account:</b> {user_name} ({user_email})", subtitle_style))
    elements.append(Paragraph(f"<b>Generated:</b> {dt.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", subtitle_style))
    elements.append(Spacer(1, 24))
    
    # 1. Summary Section
    elements.append(Paragraph("Portfolio Summary", heading_style))
    
    summary_headers = ["Total Capital", "Total Value", "Day Return (%)", "Day Return ($)", "Active Positions"]
    summary_row = [
        f"${summary_data['total_capital']:,.2f}",
        f"${summary_data['total_value']:,.2f}",
        f"{summary_data['day_return_perc']:.2f}%",
        f"${summary_data['day_return_abs']:,.2f}",
        str(summary_data['active_positions'])
    ]
    
    t_summary = Table([summary_headers, summary_row], colWidths=[106]*5)
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 10),
        ('TOPPADDING', (0,0), (-1,0), 10),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor("#f8fafc")),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0")),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('PADDING', (0,1), (-1,-1), 8),
    ]))
    elements.append(t_summary)
    elements.append(Spacer(1, 16))
    
    # 2. Holdings Section
    elements.append(Paragraph("Current Holdings", heading_style))
    
    if assets:
        asset_headers = ["Symbol", "Class", "Broker", "Qty", "Avg Price", "Current Price", "Unrealized PNL"]
        asset_rows = [asset_headers]
        for a in assets:
            qty = float(a.quantity) if a.quantity else 0
            avg_p = float(a.average_buy_price) if a.average_buy_price else 0
            cur_p = float(a.current_price) if a.current_price else 0
            pnl = float(a.pnl) if a.pnl else 0
            
            asset_rows.append([
                a.symbol,
                a.asset_class or "—",
                a.broker_name or "—",
                f"{qty:,.4f}",
                f"${avg_p:,.2f}",
                f"${cur_p:,.2f}",
                f"${pnl:,.2f}"
            ])
            
        t_assets = Table(asset_rows, colWidths=[60, 70, 80, 70, 80, 80, 90])
        t_assets.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#334155")),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('ALIGN', (3,1), (-1,-1), 'RIGHT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
            ('PADDING', (0,0), (-1,-1), 6),
        ]))
        elements.append(t_assets)
    else:
        elements.append(Paragraph("No active positions currently held.", styles['Normal']))
        
    elements.append(Spacer(1, 16))
    
    # 3. Transactions Section (Limit 50)
    elements.append(Paragraph("Recent Transactions", heading_style))
    
    if transactions:
        tx_headers = ["Date", "Symbol", "Type", "Broker", "Qty", "Price", "Total Value"]
        tx_rows = [tx_headers]
        
        for tx in transactions[:50]:
            qty = float(tx.quantity) if tx.quantity else 0
            price = float(tx.price) if tx.price else 0
            date_str = tx.timestamp.strftime("%Y-%m-%d %H:%M") if tx.timestamp else "—"
            
            tx_rows.append([
                date_str,
                tx.symbol,
                tx.transaction_type,
                tx.broker_name or "—",
                f"{qty:,.4f}",
                f"${price:,.2f}",
                f"${(qty * price):,.2f}"
            ])
            
        t_txs = Table(tx_rows, colWidths=[90, 60, 50, 80, 70, 80, 100])
        t_txs.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#334155")),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('ALIGN', (4,1), (-1,-1), 'RIGHT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
            ('PADDING', (0,0), (-1,-1), 6),
        ]))
        elements.append(t_txs)
        
        if len(transactions) > 50:
            elements.append(Spacer(1, 8))
            elements.append(Paragraph("<i>* Showing 50 most recent transactions. Export as JSON for complete history.</i>", styles['Italic']))
    else:
        elements.append(Paragraph("No recent transactions found.", styles['Normal']))
    
    # Build Document
    doc.build(elements)
    buffer.seek(0)
    return buffer
