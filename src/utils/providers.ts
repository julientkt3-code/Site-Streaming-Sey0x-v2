export interface Provider {
  id: string;
  name: string;
  movieUrl: string;
  tvUrl: string;
  warning?: string;
}

// Wrapper proxy — fait passer l'URL du lecteur par notre serveur
// qui injecte le script anti-pub avant de servir la page
const proxy = (url: string) => `/proxy?url=${encodeURIComponent(url)}`;

export const getFavoriteProviderId = (): string =>
  localStorage.getItem('favoriteProvider') || 'vidsrc';

export const setFavoriteProvider = (providerId: string): void =>
  localStorage.setItem('favoriteProvider', providerId);

export const getDefaultProvider = (): Provider => {
  const favoriteId = getFavoriteProviderId();
  return providers.find(p => p.id === favoriteId) || providers[0];
};

// URLs directes (sans proxy) — gardées pour fallback
const DIRECT = {
  vidsrc:    { movie: 'https://vidsrc.su/movie/{tmdb_id}',                             tv: 'https://vidsrc.su/tv/{tmdb_id}/{season_number}/{episode_number}' },
  vidfast:   { movie: 'https://vidfast.pro/movie/{tmdb_id}',                           tv: 'https://vidfast.pro/tv/{tmdb_id}/{season_number}/{episode_number}' },
  videasy:   { movie: 'https://player.videasy.net/movie/{tmdb_id}',                   tv: 'https://player.videasy.net/tv/{tmdb_id}/{season_number}/{episode_number}' },
  embedsu:   { movie: 'https://embed.su/embed/movie/{tmdb_id}',                       tv: 'https://embed.su/embed/tv/{tmdb_id}/{season_number}/{episode_number}' },
  vidsrcvip: { movie: 'https://vidsrc.vip/embed/movie/{tmdb_id}',                     tv: 'https://vidsrc.vip/embed/tv/{tmdb_id}/{season_number}/{episode_number}' },
  autoembed: { movie: 'https://player.autoembed.cc/embed/movie/{tmdb_id}',             tv: 'https://player.autoembed.cc/embed/tv/{tmdb_id}/{season_number}/{episode_number}' },
  '2embed':  { movie: 'https://www.2embed.cc/embed/{tmdb_id}',                        tv: 'https://www.2embed.cc/embedtv/{tmdb_id}&s={season_number}&e={episode_number}' },
};

export const providers: Provider[] = [
  {
    id: 'vidsrc',
    name: 'Vidsrc.su ⭐',
    movieUrl: proxy(DIRECT.vidsrc.movie),
    tvUrl:    proxy(DIRECT.vidsrc.tv),
  },
  {
    id: 'vidfast',
    name: 'Vidfast',
    movieUrl: proxy(DIRECT.vidfast.movie),
    tvUrl:    proxy(DIRECT.vidfast.tv),
  },
  {
    id: 'videasy',
    name: 'Videasy',
    movieUrl: proxy(DIRECT.videasy.movie),
    tvUrl:    proxy(DIRECT.videasy.tv),
  },
  {
    id: 'embedsu',
    name: 'Embed.su',
    movieUrl: proxy(DIRECT.embedsu.movie),
    tvUrl:    proxy(DIRECT.embedsu.tv),
  },
  {
    id: 'vidsrcvip',
    name: 'VidSrc.vip',
    movieUrl: proxy(DIRECT.vidsrcvip.movie),
    tvUrl:    proxy(DIRECT.vidsrcvip.tv),
  },
  {
    id: 'autoembed',
    name: 'AutoEmbed',
    movieUrl: proxy(DIRECT.autoembed.movie),
    tvUrl:    proxy(DIRECT.autoembed.tv),
  },
  {
    id: '2embed',
    name: '2Embed',
    movieUrl: proxy(DIRECT['2embed'].movie),
    tvUrl:    proxy(DIRECT['2embed'].tv),
  },
];
