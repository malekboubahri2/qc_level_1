# Déploiement — QC Level 1 (PMP)

Déploiement on-premise sur le Raspberry Pi, derrière l'ingress partagé **pmp-edge**.

L'application est accessible à **`https://qcl1.pmp.com`** — aucun port non-standard.
TLS est terminé par pmp-edge (Caddy) ; la CA interne est partagée entre toutes
les apps du Pi.

---

## Architecture de déploiement

```
Browser (*.pmp.com résolu → 192.168.1.28 par dnsmasq)
        │
        ▼ :443 (HTTPS, TLS terminé ici)
  pmp-edge (Caddy docker-proxy)
        │  route par Host: qcl1.pmp.com
        ▼ :80 (HTTP interne, réseau Docker "edge")
  qc_level1-web-1  (Caddy — SPA + /api proxy)
        │  réseau Docker "internal"
        ▼ :8000
  qc_level1-api-1  (FastAPI + SQLite)
```

---

## Prérequis sur le Pi

| Logiciel | Version minimale | Vérification |
|---|---|---|
| Docker Engine | 24+ | `docker --version` |
| Docker Compose v2 | 2.20+ | `docker compose version` |
| Git | 2.x | `git --version` |
| **pmp-edge** | en cours | `docker network inspect edge` |

**pmp-edge doit être démarré avant QC Level 1.** Il crée le réseau Docker
externe `edge` et gère le TLS pour tous les services `*.pmp.com`.

Installer Docker si absent :
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # puis se reconnecter
```

---

## Premier déploiement

### 1. Vérifier que pmp-edge est actif

```bash
docker network inspect edge >/dev/null && echo "OK" || echo "MANQUANT — démarrer pmp-edge d'abord"
```

### 2. Cloner le dépôt sur le Pi

```bash
git clone <url-du-repo> ~/qc_level1
cd ~/qc_level1
git submodule update --init deploy/edge   # référence pmp-edge (docs + trust-ca.sh)
```

### 3. Lancer le script d'installation

```bash
bash deploy/install.sh
```

Le script :
- vérifie que le réseau `edge` existe (échoue proprement sinon)
- génère `.env` depuis `.env.example` (clé JWT aléatoire)
- ouvre `.env` dans un éditeur pour que vous renseigniez les secrets
- build les images et démarre la stack
- vérifie le healthcheck `/api/v1/health`

### 4. Renseigner `.env` (étape interactive dans le script)

```env
# Clé JWT — obligatoire, longue et aléatoire
QC_SECRET_KEY=<openssl rand -hex 32>

# Mot de passe admin fort
QC_ADMIN_SECRET=mot-de-passe-fort

# Origine CORS — laisser la valeur par défaut sauf hostname différent
QC_CORS_ORIGINS=https://qcl1.pmp.com
```

> Ne jamais commiter `.env` — il est dans `.gitignore`.

---

## Mettre à jour

```bash
cd ~/qc_level1
bash deploy/update.sh
```

Pull le code + met à jour la référence du submodule pmp-edge → rebuild les
images → redémarre les containers → vérifie le health.

La base SQLite est dans le volume Docker `qc_level1_qc_data` : elle **n'est
pas écrasée** par une mise à jour.

---

## Commandes utiles

```bash
# Alias pratique (à ajouter dans ~/.bashrc)
alias qc1="docker compose -p qc_level1 -f ~/qc_level1/docker-compose.yml -f ~/qc_level1/deploy/docker-compose.prod.yml"

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

## HTTPS et confiance du certificat CA

La CA interne est **celle de pmp-edge** — partagée entre toutes les apps
`*.pmp.com`. Il suffit de l'installer **une seule fois** par appareil, même
si de nouvelles apps sont déployées ensuite.

### Extraire le certificat CA

```bash
cd ~/qc_level1
bash deploy/edge/trust-ca.sh
# → génère caddy-ca.crt dans le dossier courant
```

### Installer la CA sur chaque appareil (une seule fois)

| Appareil | Procédure |
|---|---|
| **Tablette Android** (ligne) | Transférer `caddy-ca.crt` → Paramètres → Sécurité → Certificat CA |
| **PC Windows** (bureau méthode) | Double-clic → Installer → Autorités de certification racines de confiance |
| **iPhone / iPad** | AirDrop → Paramètres → Général → VPN et gestion → Profil → Installer |
| **Linux** | `sudo cp caddy-ca.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates` |

---

## Démarrage automatique au boot

Docker redémarre les containers automatiquement (`restart: always`). Il faut
aussi que pmp-edge démarre avant QC Level 1. Docker gère cela via la dépendance
au réseau externe `edge` : si pmp-edge n'est pas là, `docker compose up` échoue
proprement.

```bash
sudo systemctl enable docker
```

---

## Sauvegarde de la base

La base SQLite est dans le volume `qc_level1_qc_data` :

```bash
docker run --rm \
  -v qc_level1_qc_data:/data \
  -v ~/backups:/backup \
  alpine \
  cp /data/qc_level1.db /backup/qc_level1_$(date +%Y%m%d).db
```

Automatiser avec cron :

```cron
0 2 * * * docker run --rm -v qc_level1_qc_data:/data -v /home/user/backups:/backup alpine cp /data/qc_level1.db /backup/qc_level1_$(date +\%Y\%m\%d).db
```

---

## Vérifications post-déploiement

```bash
# Depuis le Pi — DNS pmp-edge
docker exec pmp-edge-dns-1 nslookup qcl1.pmp.com 192.168.1.28

# App (HTTPS via edge)
curl -ks --resolve qcl1.pmp.com:443:192.168.1.28 https://qcl1.pmp.com/ -o /dev/null -w '%{http_code}\n'
# → 200

# API health
curl -ks --resolve qcl1.pmp.com:443:192.168.1.28 https://qcl1.pmp.com/api/v1/health
# → {"status":"ok"}

# Aucun port publié par qc_level1 (le réseau edge gère le trafic)
docker ps --format '{{.Names}} {{.Ports}}' | grep qc_level1
# → qc_level1-web-1   (aucun port hôte)
# → qc_level1-api-1   (aucun port hôte)
```

Ouvrir dans le navigateur : `https://qcl1.pmp.com`
Se connecter avec `admin` / `QC_ADMIN_SECRET`.
