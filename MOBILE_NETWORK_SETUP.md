# Azure PostgreSQL Firewall Setup pro Mobilní Připojení

## Problém
Váš scraper nefunguje, protože se vám díky mobilnímu připojení mění IP adresa. Azure PostgreSQL firewall blokuje nová připojení z neznámých IP.

## Řešení

Je několik možností:

### 🟢 **Řešení 1: Automatické (Doporučeno)**

Spusťte skript pro nastavení Azure Postgres firewall:

```bash
python setup_azure_postgres_firewall.py
```

Nebo přímo spusťte scraper s automatickým setupem:

```bash
bash scraper-mobile.sh
```

Tento skript:
1. ✅ Přihlásí se do Azure (pomocí credentials v `Azure IDs.txt`)
2. ✅ Najde váš PostgreSQL server
3. ✅ Vytvoří firewall rule: `AllowAllAzureIps` (0.0.0.0 - 0.0.0.0)
4. ✅ Umožní všem Azure službám připojit se (bez ohledu na IP)

**Výhody:**
- ✅ Funguje s jakýmkoli mobilním připojením
- ✅ Jednorázová konfigurace
- ✅ Aplikace pak běží normálně

**Nevýhody:**
- Trochu méně bezpečné (povoluje všechny Azure služby)
- Vyžaduje Azure SDK nebo Azure CLI

---

### 🟡 **Řešení 2: SSH Tunnel (Bezpečnější)**

Pokud máte Azure VM, můžete používat SSH tunnel:

```bash
# Na vašem počítači
ssh -L 5432:jobshaman-db-np.postgres.database.azure.com:5432 user@your-vm-ip

# V jiném terminálu, nastavte PGHOST
export PGHOST=localhost
bash scraper.sh
```

**Výhody:**
- ✅ Bezpečnější (databáze není přímo dostupná)
- ✅ Funguje s jakýmkoli připojením

**Nevýhody:**
- Vyžaduje Azure VM
- Složitější nastavení
- Vyžaduje stálý SSH tunel

---

### 🔵 **Řešení 3: Azure AD Authentication (Vývojář-orientované)**

Pokud chcete používat Azure AD místo hesla:

```bash
# Nastavte environment proměnné
export PGHOST=jobshaman-db-np.postgres.database.azure.com
export PGPORT=5432
export PGDATABASE=postgres
export PGUSER=dbadmin@jobshaman-db-np

# Přihlásit do Azure CLI
az login

# Pak spustit scraper
bash scraper.sh
```

---

## Instalace Předpokladů

### Varianta 1: Azure SDK (Python)

```bash
pip install azure-identity azure-mgmt-rdbms
```

### Varianta 2: Azure CLI

```bash
# macOS
brew install azure-cli

# Linux (Debian/Ubuntu)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Linux (Fedora/RHEL)
sudo dnf install azure-cli
```

---

## Postup

### Krok 1: Vyberte si řešení
- 🟢 **Automatické** - nejjednodušší, doporučeno pro mobilní sítě
- 🟡 **SSH Tunnel** - bezpečnější, vyžaduje VM
- 🔵 **Azure AD** - flexible, vyvojářský přístup

### Krok 2: Nainstalujte předpoklady

Pro automatické řešení:
```bash
pip install azure-identity azure-mgmt-rdbms
# nebo
brew install azure-cli
```

### Krok 3: Spusťte setup

```bash
# Pro automatické řešení
python setup_azure_postgres_firewall.py

# Nebo přímo se skriptem pro mobilní sítě
bash scraper-mobile.sh
```

### Krok 4: Ověřte připojení

```bash
# Test připojení
psql -h jobshaman-db-np.postgres.database.azure.com -U dbadmin -d postgres -c "SELECT 1"

# Heslo je v Azure IDs.txt (PGPASSWORD)
```

---

## Řešení Problémů

### "Azure credentials not found"
- Ujistěte se, že máte `Azure IDs.txt` v kořenu projektu
- Nebo nastavte environment proměnné:
  ```bash
  export AZURE_CLIENT_ID=xxx
  export AZURE_CLIENT_SECRET=xxx
  export AZURE_TENANT_ID=xxx
  export AZURE_SUBSCRIPTION_ID=xxx
  ```

### "Could not connect to database"
- Zkontrolujte, že máte správné heslo: `echo $PGPASSWORD`
- Spusťte: `python setup_azure_postgres_firewall.py --use-sdk` (pro detailní error)
- Zkontrolujte Azure Portal → Database server → Firewall rules

### "Permission denied"
- Ujistěte se, že máte práva k Azure subscription
- Zkontrolujte, že Azure credentials jsou správné

---

## Jak to Funguje

### 1. Automatické řešení
```
Your Computer (Mobile IP)
    ↓
Internet (IP changes constantly)
    ↓
Azure Firewall Rule: AllowAllAzureIps (0.0.0.0-0.0.0.0)
    ↓ ✅ Povoleno všem Azure službám
Azure PostgreSQL
```

### 2. SSH Tunnel
```
Your Computer
    ↓ (SSH encryption)
Azure VM
    ↓ (Private Azure network)
Azure PostgreSQL (default: blocked to external IPs)
```

---

## Automatizace

Pokud chcete, aby se firewall nastavil automaticky při každém spuštění:

```bash
# V .env souboru
export SETUP_AZURE_FIREWALL=1
export MOBILE_NETWORK=1
```

Pak normálně:
```bash
bash scraper.sh  # Automaticky nastaví firewall, pokud potřeba
```

---

## Bezpečnostní Poznámky

- ⚠️ `AllowAllAzureIps` povoluje všem Azure službám připojení (včetně jiných lidí v Azure)
- ✅ Je to ale ok pro:
  - Interní scraper workloads
  - Northflank jobs (kontrolované prostředí)
  - Aplikace běžící v Azure
  
- 🔐 Pokud potřebujete víc bezpečnosti, použijte SSH Tunnel nebo Azure AD Auth

---

## Kontakt / Debugging

Pokud to pořád nefunguje, spusťte s debug flagy:

```bash
# Detailní diagnostika
python setup_azure_postgres_firewall.py --use-sdk 2>&1 | head -50

# Nebo test přímého připojení
psql -h jobshaman-db-np.postgres.database.azure.com \
     -U dbadmin \
     -d postgres \
     -c "SELECT 1" 2>&1
```

Výstup pošlete v issue na GitHub.
