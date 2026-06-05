#!/usr/bin/env python3
"""
Setup Azure PostgreSQL firewall to allow JobShaman scraper from mobile networks.
Handles dynamic IP changes by allowing all Azure services.

Usage:
    python setup_azure_postgres_firewall.py [--rule-name RULE_NAME]

Environment variables required:
    AZURE_CLIENT_ID
    AZURE_CLIENT_SECRET
    AZURE_TENANT_ID
    AZURE_SUBSCRIPTION_ID
    AZURE_RESOURCE_GROUP (default: inferred from PGHOST)
    AZURE_DB_SERVER_NAME (default: inferred from PGHOST)
"""

import os
import sys
import json
import argparse
import re
from pathlib import Path
from urllib.parse import urlparse

def load_azure_credentials():
    """Load Azure credentials from environment or Azure IDs.txt"""
    creds = {}
    
    # Try environment first
    for key in ['AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_TENANT_ID', 'AZURE_SUBSCRIPTION_ID']:
        creds[key] = os.getenv(key)
    
    # If missing, try to read from Azure IDs.txt
    if not all(creds.values()):
        azure_ids_path = Path(__file__).parent / "Azure IDs.txt"
        if azure_ids_path.exists():
            with open(azure_ids_path, 'r') as f:
                content = f.read()
                # Try raw JSON first
                try:
                    data = json.loads(content)
                except Exception:
                    data = None
                # If JSON parsing failed, try to extract a JSON block from mixed file
                if data is None:
                    m = re.search(r"\{[\s\S]*?\}", content)
                    if m:
                        try:
                            data = json.loads(m.group(0))
                        except Exception:
                            data = None
                # If we have a data dict, extract expected fields
                if isinstance(data, dict):
                    creds = {
                        'AZURE_CLIENT_ID': data.get('clientId') or data.get('client_id') or creds.get('AZURE_CLIENT_ID'),
                        'AZURE_CLIENT_SECRET': data.get('clientSecret') or data.get('client_secret') or creds.get('AZURE_CLIENT_SECRET'),
                        'AZURE_TENANT_ID': data.get('tenantId') or data.get('tenant_id') or creds.get('AZURE_TENANT_ID'),
                        'AZURE_SUBSCRIPTION_ID': data.get('subscriptionId') or data.get('subscription_id') or creds.get('AZURE_SUBSCRIPTION_ID'),
                    }
                else:
                    # Fallback: parse key=value or simple JSON-like lines
                    found = {}
                    # key patterns to search for
                    # Accept quoted or unquoted keys and values, colon or equals separators
                    kv_patterns = {
                        'AZURE_CLIENT_ID': r"['\"]?clientId['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]",
                        'AZURE_CLIENT_SECRET': r"['\"]?clientSecret['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]",
                        'AZURE_TENANT_ID': r"['\"]?tenantId['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]",
                        'AZURE_SUBSCRIPTION_ID': r"['\"]?subscriptionId['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]",
                        'PGHOST': r"PGHOST\s*[=]\s*([^\s\n\r]+)",
                        'PGPASSWORD': r"PGPASSWORD\s*[=]\s*(['\"]?)([^'\"]+)\1",
                    }
                    for key, patt in kv_patterns.items():
                        m = re.search(patt, content)
                        if m:
                            # for PGPASSWORD pattern group 2 holds value
                            if key == 'PGPASSWORD':
                                found[key] = m.group(2)
                            else:
                                found[key] = m.group(1)
                    # Merge found values into creds where applicable
                    if found:
                        creds['AZURE_CLIENT_ID'] = found.get('AZURE_CLIENT_ID') or creds.get('AZURE_CLIENT_ID')
                        creds['AZURE_CLIENT_SECRET'] = found.get('AZURE_CLIENT_SECRET') or creds.get('AZURE_CLIENT_SECRET')
                        creds['AZURE_TENANT_ID'] = found.get('AZURE_TENANT_ID') or creds.get('AZURE_TENANT_ID')
                        creds['AZURE_SUBSCRIPTION_ID'] = found.get('AZURE_SUBSCRIPTION_ID') or creds.get('AZURE_SUBSCRIPTION_ID')
                        # Also export PGHOST/PGPASSWORD if present
                        if 'PGHOST' in found and not os.getenv('PGHOST'):
                            os.environ['PGHOST'] = found.get('PGHOST')
                        if 'PGPASSWORD' in found and not os.getenv('PGPASSWORD'):
                            os.environ['PGPASSWORD'] = found.get('PGPASSWORD')
    
    missing = [k for k, v in creds.items() if not v]
    if missing:
        print(f"❌ Missing Azure credentials: {', '.join(missing)}")
        print("   Set environment variables or ensure Azure IDs.txt exists")
        return None
    
    return creds


def get_db_server_info():
    """Extract database server info from environment or Azure IDs.txt"""
    host = os.getenv('PGHOST')
    if not host:
        # Try to read from Azure IDs.txt
        azure_ids_path = Path(__file__).parent / "Azure IDs.txt"
        if azure_ids_path.exists():
            with open(azure_ids_path, 'r') as f:
                for line in f:
                    if 'PGHOST=' in line:
                        host = line.split('=')[1].strip()
                        break
    
    if not host:
        print("❌ PGHOST not found in environment or Azure IDs.txt")
        return None
    
    # Parse hostname to get server name and resource group
    # Format: servername.postgres.database.azure.com
    if '.postgres.database.azure.com' not in host:
        print(f"❌ Invalid Azure PostgreSQL hostname: {host}")
        return None
    
    server_name = host.split('.')[0]
    resource_group = os.getenv('AZURE_RESOURCE_GROUP')
    
    if not resource_group:
        print(f"⚠️  AZURE_RESOURCE_GROUP not set, will try to discover...")
    
    return {
        'host': host,
        'server_name': server_name,
        'resource_group': resource_group,
    }


def setup_firewall_with_azure_cli():
    """Setup firewall using Azure CLI (if available)"""
    try:
        import subprocess
        
        db_info = get_db_server_info()
        if not db_info:
            return False
        
        creds = load_azure_credentials()
        if not creds:
            return False
        
        print("🔐 Logging in to Azure...")
        login_cmd = [
            'az', 'login',
            '--service-principal',
            '-u', creds['AZURE_CLIENT_ID'],
            '-p', creds['AZURE_CLIENT_SECRET'],
            '--tenant', creds['AZURE_TENANT_ID'],
        ]
        subprocess.run(login_cmd, check=True, capture_output=True)
        
        # Set subscription
        subprocess.run(['az', 'account', 'set', '--subscription', creds['AZURE_SUBSCRIPTION_ID']], 
                      check=True, capture_output=True)
        
        # Try to find resource group if not specified
        if not db_info['resource_group']:
            print("🔍 Discovering resource group...")
            result = subprocess.run(
                ['az', 'postgres', 'server', 'list', '--query', f"[?name=='{db_info['server_name']}'].resourceGroup", '-o', 'json'],
                capture_output=True,
                text=True,
                check=True
            )
            groups = json.loads(result.stdout)
            if not groups:
                print(f"❌ Could not find resource group for server {db_info['server_name']}")
                return False
            db_info['resource_group'] = groups[0]
        
        print(f"📍 Server: {db_info['server_name']}")
        print(f"📁 Resource Group: {db_info['resource_group']}")
        
        # Create firewall rule for "Allow all Azure services"
        print("🔥 Creating firewall rule: AllowAllAzureIps")
        subprocess.run([
            'az', 'postgres', 'server', 'firewall-rule', 'create',
            '--resource-group', db_info['resource_group'],
            '--server-name', db_info['server_name'],
            '--name', 'AllowAllAzureIps',
            '--start-ip-address', '0.0.0.0',
            '--end-ip-address', '0.0.0.0',
        ], check=True, capture_output=True)
        
        print("✅ Firewall rule created successfully!")
        print("   All Azure services can now connect to the database")
        print("   This allows scraper to work regardless of IP address changes")
        return True
        
    except ImportError:
        return None
    except Exception as e:
        print(f"❌ Azure CLI setup failed: {e}")
        return False


def setup_firewall_with_sdk():
    """Setup firewall using Azure SDK (more reliable)"""
    try:
        from azure.identity import ClientSecretCredential
        from azure.mgmt.rdbms.postgresql_flexibleservers import PostgreSQLManagementClient
        from azure.mgmt.rdbms.postgresql_flexibleservers.models import FirewallRule
        
        creds = load_azure_credentials()
        if not creds:
            return False
        
        db_info = get_db_server_info()
        if not db_info:
            return False
        
        print("🔐 Authenticating with Azure...")
        credential = ClientSecretCredential(
            tenant_id=creds['AZURE_TENANT_ID'],
            client_id=creds['AZURE_CLIENT_ID'],
            client_secret=creds['AZURE_CLIENT_SECRET'],
        )
        
        client = PostgreSQLManagementClient(
            credential,
            creds['AZURE_SUBSCRIPTION_ID'],
        )
        
        # Discover resource group if needed
        if not db_info['resource_group']:
            print("🔍 Discovering resource group by listing servers in subscription...")
            try:
                servers = client.servers.list()
                for server in servers:
                    if getattr(server, 'name', None) == db_info['server_name']:
                        # server.id format: /subscriptions/.../resourceGroups/<rg>/providers/...
                        sid = getattr(server, 'id', '') or ''
                        m = re.search(r"/resourceGroups/([^/]+)/", sid, re.IGNORECASE)
                        if m:
                            db_info['resource_group'] = m.group(1)
                            break
            except Exception:
                pass
            
            if not db_info['resource_group']:
                print(f"❌ Could not find resource group for server {db_info['server_name']}")
                return False
        
        print(f"📍 Server: {db_info['server_name']}")
        print(f"📁 Resource Group: {db_info['resource_group']}")
        
        # Create firewall rule
        print("🔥 Creating firewall rule: AllowAllAzureIps")
        rule = FirewallRule(
            start_ip_address='0.0.0.0',
            end_ip_address='0.0.0.0',
        )
        
        client.firewall_rules.create_or_update(
            db_info['resource_group'],
            db_info['server_name'],
            'AllowAllAzureIps',
            rule,
        )
        
        print("✅ Firewall rule created successfully!")
        print("   All Azure services can now connect to the database")
        print("   This allows scraper to work regardless of IP address changes")
        return True
        
    except ImportError:
        # Attempt to install into the current Python interpreter (respects venv)
        try:
            print("⚠️  Azure SDK not installed. Attempting to install into current Python environment...")
            import subprocess
            subprocess.run([sys.executable, "-m", "pip", "install", "azure-identity", "azure-mgmt-rdbms"], check=True)
            # Retry import after installation
            from azure.identity import ClientSecretCredential  # type: ignore
            from azure.mgmt.rdbms.postgresql_flexibleservers import PostgreSQLManagementClient  # type: ignore
            from azure.mgmt.rdbms.postgresql_flexibleservers.models import FirewallRule  # type: ignore
            # If we get here, proceed with the normal flow by recalling the function
            return setup_firewall_with_sdk()
        except Exception as e:
            print(f"❌ Could not install Azure SDK into current environment: {e}")
            print("   Install manually or activate the project venv and try again.")
            return None
    except Exception as e:
        print(f"❌ Azure SDK setup failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def setup_local_ssh_tunnel():
    """Setup local SSH tunnel as alternative (requires Azure VM)"""
    print("\n📚 SSH Tunnel Alternative:")
    print("   If you have an Azure VM, you can use SSH tunnel instead:")
    print("")
    print("   ssh -L 5432:jobshaman-db-np.postgres.database.azure.com:5432 user@vm-ip")
    print("")
    print("   Then set PGHOST=localhost in your environment")
    print("")


def main():
    parser = argparse.ArgumentParser(
        description="Setup Azure PostgreSQL firewall for dynamic IP (mobile networks)"
    )
    parser.add_argument(
        '--rule-name',
        default='AllowAllAzureIps',
        help='Firewall rule name (default: AllowAllAzureIps)'
    )
    parser.add_argument(
        '--use-cli',
        action='store_true',
        help='Force use of Azure CLI (if available)'
    )
    parser.add_argument(
        '--use-sdk',
        action='store_true',
        help='Force use of Azure SDK'
    )
    args = parser.parse_args()
    
    print("="*70)
    print("  AZURE POSTGRESQL FIREWALL SETUP")
    print("  For JobShaman Scraper (Mobile/Dynamic IP Support)")
    print("="*70)
    
    result = None
    
    # Try methods in order
    if args.use_sdk or not args.use_cli:
        result = setup_firewall_with_sdk()
    
    if result is None and (args.use_cli or not args.use_sdk):
        result = setup_firewall_with_azure_cli()
    
    if result is None:
        print("\n❌ Neither Azure SDK nor Azure CLI available")
        print("   Install one of:")
        print("   - pip install azure-identity azure-mgmt-rdbms")
        print("   - brew install azure-cli (or apt-get install azure-cli)")
        setup_local_ssh_tunnel()
        return 1
    
    if not result:
        print("\n❌ Setup failed. Check errors above.")
        return 1
    
    print("\n🎉 Setup complete!")
    print("\n   You can now run: bash scraper.sh")
    return 0


if __name__ == '__main__':
    sys.exit(main())
