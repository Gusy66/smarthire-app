#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para extrair texto do PDF
"""
try:
    import PyPDF2
    with open('Gustavo Bocci Pimentel.pdf', 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        text = ''
        for page in reader.pages:
            text += page.extract_text()
        print(text[:3000])
except ImportError:
    print("PyPDF2 não instalado, tentando pdfplumber...")
    try:
        import pdfplumber
        with pdfplumber.open('Gustavo Bocci Pimentel.pdf') as pdf:
            text = ''
            for page in pdf.pages:
                text += page.extract_text() or ''
            print(text[:3000])
    except ImportError:
        print("Nenhuma biblioteca de PDF disponível")
