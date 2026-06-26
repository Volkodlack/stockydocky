import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'carles_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Ajoute le token Bearer à chaque requête
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Déconnexion automatique sur 401
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && onUnauthorized) {
      const url = error.config?.url ?? '';
      // On ne déclenche pas la déconnexion sur l'échec de login lui-même
      if (!url.includes('/auth/login')) onUnauthorized();
    }
    return Promise.reject(error);
  },
);

/** Extrait un message d'erreur lisible depuis une réponse API. */
export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; details?: unknown } | undefined;
    if (data?.error) {
      if (Array.isArray(data.details) && data.details.length) {
        const first = data.details[0] as { message?: string };
        return first?.message ? `${data.error} : ${first.message}` : data.error;
      }
      return data.error;
    }
    if (error.code === 'ERR_NETWORK') return 'Serveur injoignable. Vérifiez votre connexion.';
    return error.message;
  }
  return 'Une erreur inattendue est survenue.';
}

/** Télécharge un fichier exporté (CSV/XLSX) en respectant le token JWT. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await api.get(path, { responseType: 'blob' });
  const url = window.URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/** Ouvre un PDF (bon de livraison) dans un nouvel onglet, token inclus. */
export async function openPdf(path: string): Promise<void> {
  const res = await api.get(path, { responseType: 'blob' });
  const url = window.URL.createObjectURL(res.data as Blob);
  window.open(url, '_blank');
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}
