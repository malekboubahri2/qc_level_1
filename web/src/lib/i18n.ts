/* Minimal locale dictionary. fr-TN is the only locale today; the shape leaves
   room for `ar` later (qc-level1.md §7) without pulling in an i18n framework. */

export type Locale = 'fr-TN'

export const DEFAULT_LOCALE: Locale = 'fr-TN'

const resources: Record<Locale, Record<string, string>> = {
  'fr-TN': {
    'app.title': 'QC Niveau 1',
    'app.subtitle': 'Détection précoce — PMP',
    'login.title': 'Connexion',
    'login.nom': 'Identifiant',
    'login.secret': 'Code / mot de passe',
    'login.submit': 'Se connecter',
    'login.error': 'Identifiants invalides',
    'nav.logout': 'Déconnexion',
    'role.inspecteur': 'Inspecteur',
    'role.methode': 'Méthode',
    'role.qualite': 'Qualité',
    'role.prod': 'Production',
    'role.admin': 'Administrateur',
    'page.inspecteur': 'Poste inspecteur',
    'page.methode.ecran': 'Écran méthode',
    'page.methode.mobile': 'Méthode — mobile',
    'page.admin': 'Administration',
    'page.kpis': 'Indicateurs',
    'page.placeholder': 'Écran en cours de construction — Phase 0 (squelette).',
    'common.notFound': 'Page introuvable',
    'common.backHome': "Retour à l'accueil",
    'common.connected': 'Connecté',
    'common.loading': 'Chargement…',
    'common.error': 'Erreur',
    'common.save': 'Enregistrer',
    'common.cancel': 'Annuler',
    'common.confirm': 'Confirmer',
    'common.close': 'Fermer',

    // Suivi form
    'suivi.titre': 'Contrôle chariot',
    'suivi.numChariot': 'N° Chariot',
    'suivi.numPorteObjet': 'N° Porte-Objets',
    'suivi.client': 'Client',
    'suivi.produit': 'Référence article',
    'suivi.resultat': 'Résultat contrôle',
    'suivi.resultat.OK': 'OK — Conforme',
    'suivi.resultat.NOK': 'NOK — Non conforme',
    'suivi.symptomes': 'Défauts détectés',
    'suivi.commentaire': 'Commentaire',
    'suivi.submit': 'Valider le contrôle',
    'suivi.submitting': 'Enregistrement…',
    'suivi.saved': 'Contrôle enregistré',
    'suivi.savedOffline': 'Enregistré localement — synchronisation en attente',

    // Alerte flow
    'alerte.titre': 'Lancer une alerte',
    'alerte.responsable': 'Responsable méthode à contacter',
    'alerte.severite': 'Sévérité',
    'alerte.severite.normale': 'Normale',
    'alerte.severite.urgente': 'Urgente',
    'alerte.submit': 'Envoyer l\'alerte',
    'alerte.sending': 'Envoi en cours…',
    'alerte.pending': 'Alerte envoyée — en attente d\'acquittement',
    'alerte.countdown': 'Délai restant',
    'alerte.acquittee': 'Acquittée par méthode',
    'alerte.expiree': 'Alerte expirée — aucune réponse',
    'alerte.nouveau': 'Nouveau contrôle',
    'alerte.button': 'ALERTER',

    // Connectivity / fallback
    'offline.banner': 'RÉSEAU INSTABLE — ALERTER MANUELLEMENT (appel / de vive voix)',
    'offline.check': 'Vérification de la connexion…',

    // Office screen (méthode)
    'ecran.titre': 'Tableau des alertes',
    'ecran.empty': 'Aucune alerte active',
    'ecran.alerte.chariot': 'Chariot',
    'ecran.alerte.severite': 'Sévérité',
    'ecran.alerte.demande': 'Demandeur',
    'ecran.alerte.depuis': 'Depuis',
    'ecran.acquitter': 'ACQUITTER',
    'ecran.acquitter.loading': 'Acquittement…',
    'ecran.decision.titre': 'Enregistrer la décision',
    'ecran.decision.action': 'Action effectuée',
    'ecran.decision.resultat': 'Résultat / observation',
    'ecran.decision.submit': 'Clôturer l\'alerte',
    'ecran.cloturee': 'Clôturée',
    'ecran.statut.ouverte': 'OUVERTE',
    'ecran.statut.acquittee': 'ACQUITTÉE',
    'ecran.statut.cloturee': 'CLÔTURÉE',
    'ecran.statut.expiree': 'EXPIRÉE',

    // Mobile méthode
    'mobile.titre': 'Alertes — Méthode',
    'mobile.push.enable': 'Activer les notifications push',
    'mobile.push.enabled': 'Notifications activées',
    'mobile.push.denied': 'Notifications refusées par le navigateur',
    'mobile.push.loading': 'Activation…',
    'mobile.noAlertes': 'Aucune alerte en cours',

    // KPIs
    'kpis.titre': 'Indicateurs qualité',
    'kpis.depuis': 'Depuis',
    'kpis.tauxNc.titre': 'Taux NC production',
    'kpis.tauxNc.yAxis': 'Taux NC',
    'kpis.tauxNc.empty': 'Aucune donnée',
    'kpis.precurseurs.titre': 'Pareto précurseurs',
    'kpis.precurseurs.yAxis': 'Occurrences',
    'kpis.precurseurs.empty': 'Aucun précurseur détecté',
    'kpis.tempsReponse.titre': 'Temps de réponse (s)',
    'kpis.tempsReponse.yAxis': 'Durée (s)',
    'kpis.tempsReponse.empty': 'Aucune alerte acquittée',
    'kpis.export': 'Exporter PDF (SVI-COQ-03)',
    'kpis.exporting': 'Génération…',

    // Visa
    'visa.titre': 'Visa',
    'visa.qualite': 'Visa Qualité',
    'visa.prod': 'Visa Production',
    'visa.methode': 'Visa Méthode',
    'visa.sign': 'Signer',
    'visa.signed': 'Signé',
    'visa.notSigned': 'En attente',
  },
}

export function t(key: string, locale: Locale = DEFAULT_LOCALE): string {
  return resources[locale][key] ?? key
}
