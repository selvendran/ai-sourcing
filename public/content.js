// ============================================================================
// content.js - The Multi-Platform Passive Observer
// ============================================================================

// 1. PLATFORM MATCHERS (Matches the 10 configs in worker.js)
const MATCHERS = [
  { source: 'linkedin', test: (h) => h.includes('linkedin.com/in/') && !h.includes('/jobs/'), slug: (h) => h.split('/in/')[1]?.split(/[/?#]/)[0] },
  { source: 'github', test: (h) => /^https:\/\/github\.com\/[A-Za-z0-9-]+\/?(\?.*)?$/.test(h) && !/github\.com\/(orgs|topics)/.test(h), slug: (h) => h.replace(/^https:\/\/github\.com\//, '').split(/[/?#]/)[0] },
  { source: 'stackoverflow', test: (h) => /stackoverflow\.com\/users\/\d+/.test(h), slug: (h) => h.split('/users/')[1]?.split(/[/?#]/)[0] },
  { source: 'twitter', test: (h) => /^https:\/\/(twitter\.com|x\.com)\/[A-Za-z0-9_]+\/?(\?.*)?$/.test(h) && !/(twitter\.com|x\.com)\/(i|home|search)/.test(h), slug: (h) => h.replace(/^https:\/\/(twitter\.com|x\.com)\//, '').split(/[/?#]/)[0] },
  { source: 'dribbble', test: (h) => /^https:\/\/dribbble\.com\/[A-Za-z0-9_-]+\/?(\?.*)?$/.test(h) && !/dribbble\.com\/(shots|jobs)/.test(h), slug: (h) => h.replace(/^https:\/\/dribbble\.com\//, '').split(/[/?#]/)[0] },
  { source: 'wellfound', test: (h) => h.includes('wellfound.com/u/'), slug: (h) => h.split('/u/')[1]?.split(/[/?#]/)[0] },
  { source: 'xing', test: (h) => h.includes('xing.com/profile/'), slug: (h) => h.split('/profile/')[1]?.split(/[/?#]/)[0] },
  { source: 'coroflot', test: (h) => /^https:\/\/(www\.)?coroflot\.com\/[A-Za-z0-9_-]+\/?(\?.*)?$/.test(h) && !/coroflot\.com\/(jobs|search)/.test(h), slug: (h) => h.replace(/^https:\/\/(www\.)?coroflot\.com\//, '').split(/[/?#]/)[0] },
  { source: 'scholar', test: (h) => /scholar\.google\.com\/citations\?.*\buser=/.test(h), slug: (h) => h.match(/[?&]user=([^&]+)/)?.[1] },
  { source: 'googlesites', test: (h) => /^https:\/\/sites\.google\.com\/(view|site)\/[A-Za-z0-9_-]+/.test(h), slug: (h) => h.match(/sites\.google\.com\/(?:view|site)\/([A-Za-z0-9_-]+)/)?.[1] }
];

// 2. THE EXTRACTOR (Works on Search Pages AND Profile Pages)
function extractRichProfiles() {
  const profiles = [];
  const seen = new Set();

  // MODE A: Extracting from Google/Bing Search Result Pages
  if (window.location.href.includes('google.com/search') || window.location.href.includes('bing.com/search')) {
    document.querySelectorAll('a[href]').forEach(a => {
      let href = a.href;

      // Unwrap Google tracking links
      const wrapped = href.match(/[?&]q=([^&]+)/);
      if (href.includes('google.com/url') && wrapped) {
        href = decodeURIComponent(wrapped[1]);
      }

      for (const matcher of MATCHERS) {
        if (!matcher.test(href) || seen.has(href)) continue;
        const slug = matcher.slug(href);
        if (!slug || slug.length < 4) continue;

        const container = a.closest('div.g') || a.closest('li.b_algo') || a.parentElement;
        seen.add(href);
        
        profiles.push({
          id: `${matcher.source}_${slug}`,
          name: a.textContent.trim().slice(0, 100),
          title: '',
          text: container ? container.innerText.trim() : a.textContent.trim(),
          source: matcher.source,
          url: href
        });
        break;
      }
    });
  } 
  // MODE B: Extracting from the specific Profile Page (e.g., LinkedIn)
  else if (window.location.href.includes('linkedin.com/in/')) {
    const slug = window.location.href.split('/in/')[1]?.split(/[/?#]/)[0];
    profiles.push({
      id: `linkedin_${slug}`,
      name: document.title.split('|')[0].trim(),
      title: '',
      text: document.body.innerText.slice(0, 5000),
      source: 'linkedin',
      url: window.location.href
    });
  }

  if (profiles.length > 0) {
    chrome.runtime.sendMessage({ type: 'AUTO_INGEST', profiles });
  }
}

// 3. PASSIVE OBSERVER HOOK
const observer = new MutationObserver(() => {
  if (document.body.innerText.length > 500) {
    observer.disconnect();
    setTimeout(extractRichProfiles, 1500);
  }
});
observer.observe(document.body, { childList: true, subtree: true });
