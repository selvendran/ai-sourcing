// Injected on demand into the active tab when the recruiter clicks
// "Scrape This Tab" in the popup. Works on a Google/Bing search results
// page (or the platform's own search page) for any of the configured
// platforms — it doesn't care which one, it just looks for URL patterns
// that match a known platform's profile page shape.
(function extractProfiles() {
  const MATCHERS = [
    {
      source: 'linkedin',
      test: (href) => href.includes('linkedin.com/in/') && !href.includes('/jobs/') && !href.includes('/posts/'),
      slug: (href) => href.split('/in/')[1]?.split(/[/?#]/)[0],
    },
    {
      source: 'github',
      test: (href) => /^https:\/\/github\.com\/[A-Za-z0-9-]+\/?(\?.*)?$/.test(href)
        && !/github\.com\/(orgs|topics|settings|marketplace|sponsors|about|features|pricing)(\/|\?|$)/.test(href),
      slug: (href) => href.replace(/^https:\/\/github\.com\//, '').split(/[/?#]/)[0],
    },
    {
      source: 'stackoverflow',
      test: (href) => /stackoverflow\.com\/users\/\d+/.test(href),
      slug: (href) => href.split('/users/')[1]?.split(/[/?#]/)[0],
    },
    {
      source: 'twitter',
      test: (href) => /^https:\/\/(twitter\.com|x\.com)\/[A-Za-z0-9_]+\/?(\?.*)?$/.test(href)
        && !/(twitter\.com|x\.com)\/(i|home|search|settings|explore|notifications|messages)(\/|\?|$)/.test(href),
      slug: (href) => href.replace(/^https:\/\/(twitter\.com|x\.com)\//, '').split(/[/?#]/)[0],
    },
    {
      source: 'dribbble',
      test: (href) => /^https:\/\/dribbble\.com\/[A-Za-z0-9_-]+\/?(\?.*)?$/.test(href)
        && !/dribbble\.com\/(shots|jobs|search|stories)(\/|\?|$)/.test(href),
      slug: (href) => href.replace(/^https:\/\/dribbble\.com\//, '').split(/[/?#]/)[0],
    },
    {
      source: 'wellfound',
      test: (href) => href.includes('wellfound.com/u/'),
      slug: (href) => href.split('/u/')[1]?.split(/[/?#]/)[0],
    },
    {
      source: 'xing',
      test: (href) => href.includes('xing.com/profile/'),
      slug: (href) => href.split('/profile/')[1]?.split(/[/?#]/)[0],
    },
    {
      source: 'coroflot',
      test: (href) => /^https:\/\/(www\.)?coroflot\.com\/[A-Za-z0-9_-]+\/?(\?.*)?$/.test(href)
        && !/coroflot\.com\/(jobs|search)(\/|\?|$)/.test(href),
      slug: (href) => href.replace(/^https:\/\/(www\.)?coroflot\.com\//, '').split(/[/?#]/)[0],
    },
    {
      // Reliable: Google Scholar author pages always carry a fixed user= id.
      source: 'scholar',
      test: (href) => /scholar\.google\.com\/citations\?.*\buser=/.test(href),
      slug: (href) => href.match(/[?&]user=([^&]+)/)?.[1],
    },
    {
      // Looser: personal Google Sites have no fixed profile shape (sites.google.com/view/<name>
      // or /site/<name>), so this catches candidates rather than guarantees a person's profile —
      // expect more false positives here than the other matchers.
      source: 'googlesites',
      test: (href) => /^https:\/\/sites\.google\.com\/(view|site)\/[A-Za-z0-9_-]+/.test(href),
      slug: (href) => href.match(/sites\.google\.com\/(?:view|site)\/([A-Za-z0-9_-]+)/)?.[1],
    },
  ];

  const seen = new Set();
  const profiles = [];

  document.querySelectorAll('a[href]').forEach((a) => {
    let href = a.href;

    const wrapped = href.match(/[?&]q=([^&]+)/);
    if (href.includes('google.com/url') && wrapped) {
      href = decodeURIComponent(wrapped[1]);
    }
    if (href.includes('bing.com/ck/a') && href.includes('&u=')) {
      const bingMatch = href.match(/[?&]u=([^&]+)/);
      if (bingMatch) {
        try {
          href = atob(decodeURIComponent(bingMatch[1]).replace(/^a1/, ''));
        } catch {
          // If Bing's base64 variant doesn't decode cleanly, just skip unwrapping.
        }
      }
    }

    for (const matcher of MATCHERS) {
      if (!matcher.test(href)) continue;
      if (seen.has(href)) return;

      const slug = matcher.slug(href);
      if (!slug || slug.length < 4) return;

      seen.add(href);
      profiles.push({
        id: `${matcher.source}_${slug}`,
        name: (a.textContent || slug.replace(/-/g, ' ')).trim().slice(0, 200),
        title: '',
        text: (a.textContent || '').trim(),
        source: matcher.source,
        url: href,
      });
      break;
    }
  });

  return profiles.slice(0, 50);
})();