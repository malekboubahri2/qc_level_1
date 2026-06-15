# Déploiement — QC Level 1 (PMP)

Déploiement on-premise sur un Raspberry Pi (ou toute machine Linux avec Docker).

---

## Prérequis sur le Pi

| Logiciel | Version minimale | Vérification |
|---|---|---|
| Docker Engine | 24+ | `docker --version` |
| Docker Compose v2 | 2.20+ | `docker compose version` |
| Git | 2.x | `git --version` |
| openssl | (standard) | `openssl version` |

Installer Docker si absent :

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # puis se reconnecter
```

---

## Coexistence avec les services existants

Le Pi héberge déjà `qc-server` et `dashboard`. QC Level 1 s'installe **à côté**, sans interférer :

| Ce qui l'isole | Détail |
|---|---|
| **Nom de projet Compose** | `-p qc_level1` → tous les containers/réseaux/volumes sont préfixés `qc_level1_` |
| **Ports** | HTTP `8180`, HTTPS `8443` (non-standard → ports 80/443 restent libres) |
| **Volumes nommés** | `qc_level1_qc_data`, `qc_level1_caddy_data`, `qc_level1_caddy_config` |

Pour changer les ports s'ils sont déjà pris, ajouter dans `.env` :

```env
QC_HTTP_PORT=8280
QC_HTTPS_PORT=8543
```

---

## Premier déploiement

### 1. Cloner le dépôt sur le Pi

```bash
git clone <url-du-repo> /opt/qc_level1
cd /opt/qc_level1
```

### 2. Lancer le script d'installation

```bash
bash deploy/install.sh
```

Le script :
- vérifie les prérequis
- génère `.env` depuis `.env.example` (clé JWT aléatoire, IP LAN auto-détectée)
- ouvre `.env` dans un éditeur pour que vous renseigniez les secrets
- build les images et démarre la stack
- vérifie le healthcheck `/api/v1/health`

### 3. Renseigner `.env` (étape interactive dans le script)

```env
# Hostname ou IP que les navigateurs utiliseront (ex : qcl1.atelier.local ou 192.168.1.28)
SITE_ADDRESS=192.168.1.28

# Doit correspondre à l'URL complète ouverte par les navigateurs
QC_CORS_ORIGINS=https://192.168.1.28:8443

# Mot de passe admin fort
QC_ADMIN_SECRET=mot-de-passe-fort

# Ports (laisser par défaut sauf conflit)
QC_HTTP_PORT=8180
QC_HTTPS_PORT=8443
```

> Ne jamais commiter `.env` — il est dans `.gitignore`.

---

## Mettre à jour

```bash
cd /opt/qc_level1
bash deploy/update.sh
```

Pull le code → rebuild les images → redémarre les containers → vérifie le health.  
La base SQLite est dans un volume Docker (`qc_level1_qc_data`) : elle **n'est pas écrasée** par une mise à jour.

---

## Commandes utiles

Toutes les commandes Compose s'exécutent depuis `/opt/qc_level1` avec le préfixe `-p qc_level1 -f docker-compose.yml -f deploy/docker-compose.prod.yml`.

```bash
# Alias pratique (à ajouter dans ~/.bashrc)
alias qc1="docker compose -p qc_level1 -f /opt/qc_level1/docker-compose.yml -f /opt/qc_level1/deploy/docker-compose.prod.yml"

# Statut des containers
qc1 ps

# Logs en temps réel
qc1 logs -f api
qc1 logs -f web

# Redémarrer un service
qc1 restart api

# Arrêter la stack (volumes conservés)
qc1 down

# Arrêter ET supprimer les volumes (⚠ efface la base)
qc1 down -v
```

---

## HTTPS et confiance du certificat

Caddy génère son propre certificat signé par une **CA interne** (pas de Let's Encrypt — le Pi n'est pas accessible depuis Internet). Les navigateurs affichent une alerte TLS tant que la CA n'est pas installée.

### Extraire le certificat CA

```bash
cd /opt/qc_level1
bash deploy/trust-ca.sh
# → génère caddy-ca.crt dans le dossier courant
```

### Installer la CA sur chaque appareil (une seule fois)

| Appareil | Procédure |
|---|---|
| **Tablette Android** (ligne) | Transférer `caddy-ca.crt` → Paramètres → Sécurité → Certificat CA |
| **PC Windows** (bureau méthode) | Double-clic → Installer → Autorités de certification racines de confiance |
| **iPhone / iPad** | AirDrop → Paramètres → Général → VPN et gestion → Profil → Installer |
| **Linux** | `sudo cp caddy-ca.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates` |

### Utiliser un vrai hostname LAN (recommandé)

Si le réseau dispose d'un DNS interne ou d'un fichier `hosts` centralisé, utiliser un hostname plutôt qu'une IP :

```env
SITE_ADDRESS=qcl1.atelier.local
QC_CORS_ORIGINS=https://qcl1.atelier.local:8443
```

Ajouter l'entrée DNS (ou dans `/etc/hosts` de chaque client) :

```
192.168.1.28  qcl1.atelier.local
```

---

## Démarrage automatique au boot

Docker redémarre les containers automatiquement (`restart: always` dans `docker-compose.prod.yml`). Aucune configuration systemd supplémentaire n'est nécessaire si le daemon Docker démarre au boot :

```bash
sudo systemctl enable docker
```

---

## Sauvegarde de la base

La base SQLite est dans le volume Docker `qc_level1_qc_data`. Sauvegarder :

```bash
# Sur le Pi
docker run --rm \
  -v qc_level1_qc_data:/data \
  -v /home/pi/backups:/backup \
  alpine \
  cp /data/qc_level1.db /backup/qc_level1_$(date +%Y%m%d).db
```

Automatiser avec cron :

```cron
0 2 * * * docker run --rm -v qc_level1_qc_data:/data -v /home/pi/backups:/backup alpine cp /data/qc_level1.db /backup/qc_level1_$(date +\%Y\%m\%d).db
```

---

## Vérifications post-déploiement

```bash
# Healthcheck API
curl -k https://192.168.1.28:8443/api/v1/health
# → {"status":"ok"}

# Statut des containers
docker compose -p qc_level1 ps
# → api et web doivent être "running (healthy)" / "running"
```

Ouvrir dans le navigateur : `https://192.168.1.28:8443`  
Se connecter avec `admin` / `QC_ADMIN_SECRET`.
