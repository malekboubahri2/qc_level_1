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
  },
}

export function t(key: string, locale: Locale = DEFAULT_LOCALE): string {
  return resources[locale][key] ?? key
}
