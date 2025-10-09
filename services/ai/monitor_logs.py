#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import subprocess
import sys
import time

def monitor_ai_logs():
    """
    Monitora os logs do serviço de IA em tempo real
    """
    print("🔍 Monitorando logs do serviço de IA...")
    print("📝 Aguardando requisições...")
    print("=" * 50)
    
    try:
        # Executar o serviço de IA e capturar logs
        process = subprocess.Popen(
            [sys.executable, "main_enhanced.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        # Ler logs em tempo real
        for line in iter(process.stdout.readline, ''):
            if line.strip():
                print(f"[IA] {line.strip()}")
                
                # Destacar logs importantes
                if "User ID recebido" in line:
                    print("🔑 USER ID ENCONTRADO!")
                elif "Chave decodificada" in line:
                    print("✅ CHAVE CARREGADA!")
                elif "Chave de ambiente: VAZIA" in line:
                    print("❌ CHAVE VAZIA!")
                elif "análise simulada" in line:
                    print("⚠️ USANDO ANÁLISE SIMULADA!")
                    
    except KeyboardInterrupt:
        print("\n🛑 Monitoramento interrompido")
        process.terminate()
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    monitor_ai_logs()
