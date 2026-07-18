/**
 * gen-cms-config.mjs — generate public/admin/config.yml for Decap CMS.
 *
 * The schema mirrors content/pages/**.json exactly. This matters: Decap
 * rewrites the whole file on save, so ANY field not declared here is silently
 * dropped. Machine fields (srcset, layout, path, slug, depth, pos) are declared
 * as `hidden` so they survive a round-trip untouched.
 *
 * The section-type list is one shared JS array reused by every page, so js-yaml
 * emits it once as a YAML anchor and aliases it — keeping config.yml small.
 *
 * Run: npm run cms:config
 */
import { dump } from 'js-yaml';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PAGES = join(ROOT, 'content', 'pages');

// single source of truth for the live domain: content/site.json → baseUrl.
// "View Live" links in the CMS follow it, so cutover is one edit in one file.
const siteData = JSON.parse(readFileSync(join(ROOT, 'content', 'site.json'), 'utf8'));
const SITE_URL = (siteData.baseUrl || 'https://rosehill-college-website.pages.dev').replace(/\/$/, '');

// ---------- field helpers ----------
const str = (name, label, extra = {}) => ({ label, name, widget: 'string', required: false, ...extra });
const txt = (name, label, extra = {}) => ({ label, name, widget: 'text', required: false, ...extra });
const bool = (name, label) => ({ label, name, widget: 'boolean', required: false, default: false });
const hidden = (name) => ({ label: name, name, widget: 'hidden', required: false });
const md = (name, label, hint) => ({
  label, name, widget: 'markdown', required: false,
  hint: hint || 'Formatted text. Existing content is HTML and is preserved as-is.',
});

/** image object: {src, alt, srcset?, pos?} — srcset/pos kept hidden so they round-trip */
const image = (name = 'image', label = 'Image') => ({
  label, name, widget: 'object', required: false, collapsed: true,
  fields: [
    { label: 'Photo', name: 'src', widget: 'image', required: false, hint: 'Choose an existing photo or upload a new one' },
    str('alt', 'Alt text — describe what is in the photo', { hint: 'Read aloud to people using a screen reader. Leave blank only if purely decorative.' }),
    hidden('srcset'), hidden('pos'), hidden('fit'), hidden('ar'),
  ],
});

const actions = () => ({
  label: 'Buttons', name: 'actions', widget: 'list', required: false, collapsed: true,
  label_singular: 'Button', summary: '{{fields.label}}  →  {{fields.href}}',
  fields: [
    str('label', 'Button text'),
    str('href', 'Link'),
    bool('primary', 'Primary (red) button'),
    bool('external', 'Links to another website'),
  ],
});

/** eyebrow / heading / lede block shared by most sections */
const head = () => [
  str('eyebrow', 'Eyebrow (small label above the heading)'),
  bool('reo', 'Eyebrow is te reo Māori'),
  str('heading', 'Heading'),
  txt('lede', 'Intro paragraph'),
];

const anchorId = () => hidden('id');

// ---------- section types ----------
// NOTE: `name` must match the "type" value in the JSON (typeKey: type).
const S = {
  hero: {
    label: 'Hero (page top)', name: 'hero', widget: 'object',
    fields: [...head(), image(), actions()],
  },
  prose: {
    label: 'Text block', name: 'prose', widget: 'object',
    fields: [anchorId(), ...head().filter(f => f.name !== 'lede'), md('html', 'Content'), {
      label: 'Side panel', name: 'aside', widget: 'object', required: false, collapsed: true,
      fields: [image(), md('html', 'Side panel content')],
    }],
  },
  'media-text': {
    label: 'Photo + text', name: 'media-text', widget: 'object',
    fields: [anchorId(), ...head().filter(f => f.name !== 'lede'), image(), md('html', 'Content'),
      bool('flip', 'Put the photo on the right'), bool('portrait', 'Tall (portrait) photo'), actions()],
  },
  gallery: {
    label: 'Photo gallery', name: 'gallery', widget: 'object',
    fields: [str('heading', 'Heading'), txt('lede', 'Intro paragraph'), {
      label: 'Photos', name: 'images', widget: 'list', label_singular: 'Photo', collapsed: true,
      summary: '{{fields.caption}} {{fields.alt}}',
      fields: [
        { label: 'Photo', name: 'src', widget: 'image', required: false },
        str('alt', 'Alt text'), str('caption', 'Caption'), hidden('srcset'),
      ],
    }],
  },
  cards: {
    label: 'Link cards', name: 'cards', widget: 'object',
    fields: [anchorId(), ...head(), {
      label: 'Cards', name: 'cards', widget: 'list', label_singular: 'Card', collapsed: true,
      summary: '{{fields.title}}',
      fields: [str('title', 'Title'), txt('text', 'Description'), str('href', 'Link'),
        str('cta', 'Link text (e.g. View)'), bool('external', 'Links to another website'), image()],
    }],
  },
  table: {
    label: 'Table', name: 'table', widget: 'object',
    fields: [anchorId(), ...head(), str('caption', 'Table caption (for screen readers)'),
      // short string lists stay expanded — collapsed they'd just read "Heading, Heading"
      { label: 'Column headings', name: 'columns', widget: 'list', required: false, collapsed: false, field: str('col', 'Heading') },
      {
        label: 'Rows', name: 'rows', widget: 'list', required: false, label_singular: 'Row', collapsed: false,
        hint: 'Each row is a list of cells, left to right. The first cell is the row heading.',
        field: { label: 'Cells', name: 'cells', widget: 'list', collapsed: false, field: str('cell', 'Cell') },
      },
      txt('note', 'Note under the table')],
  },
  list: {
    label: 'Definition list (term + description)', name: 'list', widget: 'object',
    fields: [anchorId(), ...head(), {
      label: 'Items', name: 'items', widget: 'list', label_singular: 'Item', collapsed: true,
      summary: '{{fields.term}}',
      fields: [str('term', 'Term (e.g. a date or department)'), txt('text', 'Description')],
    }],
  },
  quote: {
    // careful: here `reo` is the te reo QUOTE TEXT, not a boolean flag
    label: 'Pull quote', name: 'quote', widget: 'object',
    fields: [str('reo', 'Te reo Māori quote (optional, shown above)'), txt('text', 'Quote'), str('attribution', 'Who said it')],
  },
  stats: {
    label: 'Statistics band', name: 'stats', widget: 'object',
    fields: [...head(), {
      label: 'Stats', name: 'stats', widget: 'list', label_singular: 'Stat', collapsed: true,
      summary: '{{fields.value}} — {{fields.label}}',
      fields: [str('value', 'Value (e.g. 1970)'), str('label', 'Label')],
    }],
  },
  cta: {
    label: 'Call to action band', name: 'cta', widget: 'object',
    fields: [anchorId(), str('eyebrow', 'Eyebrow'), bool('reo', 'Eyebrow is te reo Māori'),
      str('heading', 'Heading'), txt('text', 'Text'), image(), actions()],
  },
  accordion: {
    label: 'Accordion (expandable sections)', name: 'accordion', widget: 'object',
    fields: [anchorId(), ...head(), {
      label: 'Items', name: 'items', widget: 'list', label_singular: 'Item', collapsed: true,
      summary: '{{fields.title}}',
      fields: [str('title', 'Title'), md('html', 'Content'), bool('open', 'Open by default')],
    }],
  },
  timeline: {
    label: 'Timeline', name: 'timeline', widget: 'object',
    fields: [...head(), {
      label: 'Entries', name: 'entries', widget: 'list', label_singular: 'Entry', collapsed: true,
      summary: '{{fields.year}} {{fields.title}}',
      fields: [str('year', 'Year'), str('title', 'Title'), md('html', 'Content'), image()],
    }],
  },
  people: {
    label: 'People / staff list', name: 'people', widget: 'object',
    fields: [str('heading', 'Heading'), txt('lede', 'Intro paragraph'), bool('compact', 'Compact layout'), {
      label: 'Groups', name: 'groups', widget: 'list', label_singular: 'Group', collapsed: true,
      summary: '{{fields.title}}',
      fields: [str('title', 'Group title'), {
        label: 'People', name: 'people', widget: 'list', label_singular: 'Person', collapsed: true,
        summary: '{{fields.name}} — {{fields.role}}',
        fields: [str('name', 'Name'), str('role', 'Role'), str('email', 'Email')],
      }],
    }],
  },
  docs: {
    // careful: `columns` here is a BOOLEAN layout flag (not table columns)
    label: 'Document downloads', name: 'docs', widget: 'object',
    fields: [anchorId(), str('heading', 'Heading'), txt('lede', 'Intro paragraph'),
      bool('columns', 'Show in two columns'), {
        label: 'Documents', name: 'docs', widget: 'list', label_singular: 'Document', collapsed: true,
        summary: '{{fields.label}}',
        fields: [str('label', 'Title'), str('href', 'File link (e.g. /assets/docs/name.pdf)'), str('meta', 'Meta (e.g. PDF)')],
      }],
  },
  embed: {
    label: 'Embed (video / map / calendar)', name: 'embed', widget: 'object',
    fields: [anchorId(), ...head(), str('src', 'Embed URL'), str('iframeTitle', 'Accessible title for the embed'),
      bool('tall', 'Taller frame'), bool('facade', 'Click-to-load (use for heavy embeds)'),
      str('facadeLabel', 'Click-to-load button text'), txt('note', 'Note under the embed'), {
        label: 'Multiple embeds (optional grid)', name: 'embeds', widget: 'list', required: false, collapsed: true,
        fields: [str('src', 'Embed URL'), str('iframeTitle', 'Accessible title')],
      }],
  },
  'contact-form': {
    label: 'Contact form', name: 'contact-form', widget: 'object',
    fields: [anchorId(), ...head(), md('aside', 'Side panel content')],
  },
  search: { label: 'Search box', name: 'search', widget: 'object', fields: [hidden('id')] },
  'news-list': {
    label: 'News list', name: 'news-list', widget: 'object',
    fields: [anchorId(), ...head(), {
      label: 'Featured story', name: 'feature', widget: 'object', required: false, collapsed: true,
      fields: [str('title', 'Title'), txt('text', 'Summary'), str('href', 'Link'), image()],
    }, {
      label: 'Stories', name: 'items', widget: 'list', label_singular: 'Story', collapsed: true,
      summary: '{{fields.title}}',
      fields: [str('title', 'Title'), txt('text', 'Summary'), str('href', 'Link'), image()],
    }],
  },
};

// homepage-only chapters
const HOME = {
  'home-hero': {
    label: 'Homepage hero (crest + motto)', name: 'home-hero', widget: 'object',
    fields: [str('motto', 'Motto (te reo Māori)'), txt('vision', 'Vision (English)'), {
      label: 'Background video', name: 'video', widget: 'object', collapsed: true,
      fields: [hidden('poster'), hidden('mp4'), hidden('webm')],
    }],
  },
  'home-values': {
    label: 'Homepage — vision & values', name: 'home-values', widget: 'object',
    fields: [...head(), {
      label: 'Values (ngā pou)', name: 'values', widget: 'list', label_singular: 'Value', collapsed: true,
      summary: '{{fields.reo}} — {{fields.english}}',
      fields: [str('reo', 'Te reo name (e.g. Manaakitanga)'), str('english', 'English name (e.g. Connect)'),
        txt('meaning', 'Meaning'), image()],
    }],
  },
  'home-life': {
    label: 'Homepage — life gallery (pinned)', name: 'home-life', widget: 'object',
    fields: [...head(), {
      label: 'Photos', name: 'images', widget: 'list', label_singular: 'Photo', collapsed: true,
      summary: '{{fields.caption}}',
      fields: [{ label: 'Photo', name: 'src', widget: 'image', required: false },
        str('alt', 'Alt text'), str('caption', 'Caption'), hidden('srcset'), hidden('depth')],
    }],
  },
  'home-journey': {
    label: 'Homepage — Year 9 to 13 journey', name: 'home-journey', widget: 'object',
    fields: [...head(), {
      label: 'Steps', name: 'steps', widget: 'list', label_singular: 'Step', collapsed: true,
      summary: 'Year {{fields.year}} — {{fields.title}}',
      fields: [str('year', 'Year (9–13)'), str('title', 'Title'), txt('text', 'Text'), {
        label: 'Link', name: 'link', widget: 'object', required: false, collapsed: true,
        fields: [str('label', 'Link text'), str('href', 'Link')],
      }, image()],
    }],
  },
  'home-cocurricular': {
    label: 'Homepage — co-curricular montage', name: 'home-cocurricular', widget: 'object',
    fields: [...head(), {
      label: 'Rows', name: 'rows', widget: 'list', label_singular: 'Row', collapsed: true,
      fields: [{
        label: 'Photos', name: 'images', widget: 'list', label_singular: 'Photo', collapsed: true,
        summary: '{{fields.label}}',
        fields: [{ label: 'Photo', name: 'src', widget: 'image', required: false },
          str('alt', 'Alt text'), str('label', 'Caption label (e.g. Netball)'), hidden('srcset')],
      }],
    }, actions()],
  },
};

// ONE shared array reference → js-yaml emits an anchor and aliases it per page
const PAGE_TYPES = Object.values(S);
const HOME_TYPES = [...Object.values(HOME), S.embed, S['news-list'], S.cta];

const sectionsField = (types) => ({
  label: 'Sections', name: 'sections', widget: 'list', typeKey: 'type', types,
  summary: '{{fields.heading}}',
  hint: 'Each block is one section of the page. Drag to reorder.',
});

// ---------- discover pages ----------
function walk(dir) {
  return readdirSync(dir).flatMap((e) => {
    const f = join(dir, e);
    return statSync(f).isDirectory() ? walk(f) : (e.endsWith('.json') ? [f] : []);
  });
}

const pretty = (p) => p.replace(/\.json$/, '').split(/[\\/]/).pop()
  .replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const files = [];
for (const abs of walk(PAGES).sort()) {
  const rel = abs.slice(ROOT.length + 1).replaceAll('\\', '/');
  const data = JSON.parse(readFileSync(abs, 'utf8'));
  const isHome = data.path === 'index.html';
  const section = rel.replace('content/pages/', '').includes('/')
    ? rel.replace('content/pages/', '').split('/')[0].replace(/-/g, ' ')
    : 'General';
  files.push({
    name: rel.replace('content/pages/', '').replace(/\.json$/, '').replace(/[\\/]/g, '-'),
    label: (isHome ? 'Homepage' : pretty(rel)) + (section !== 'General' ? ` — ${section}` : ''),
    file: rel,
    format: 'json',
    // "View Live" (top-right) opens the real published page at its clean URL
    preview_path: isHome ? '' : data.path.replace(/\.html$/, ''),
    fields: [
      // machine fields: never edited, but must be declared or they'd be dropped
      { label: 'layout', name: 'layout', widget: 'hidden', default: data.layout },
      { label: 'path', name: 'path', widget: 'hidden', default: data.path },
      { label: 'slug', name: 'slug', widget: 'hidden', default: data.slug },
      // keeps utility pages (search, 404, My RHC) out of Google; hidden so it
      // round-trips instead of being dropped when staff save the page
      { label: 'noindex', name: 'noindex', widget: 'hidden' },
      { label: 'Page title', name: 'title', widget: 'string' },
      { label: 'Search-engine description', name: 'metaDescription', widget: 'text', required: false },
      sectionsField(isHome ? HOME_TYPES : PAGE_TYPES),
    ],
  });
}

// ---------- global settings ----------
const settings = {
  name: 'settings',
  label: 'Site settings',
  // no inline preview: Decap's default preview can't load the site's CSS/fonts/
  // theme, so it renders a misleading unstyled dump. Editors use "View Live"
  // (top-right) to see the real, published page instead.
  editor: { preview: false },
  files: [{
    name: 'site',
    label: 'Contact details, nav & footer',
    file: 'content/site.json',
    format: 'json',
    fields: [
      {
        label: '🔔 Urgent notice banner (homepage)', name: 'notice', widget: 'object',
        hint: 'Shows a banner across the top of the homepage. Turn Show on, type the message, and Publish. Goes live in ~1–2 minutes.',
        fields: [
          { label: 'Show the banner', name: 'active', widget: 'boolean', default: false,
            hint: 'Turn OFF to take the banner down.' },
          { label: 'Level (sets the colour)', name: 'level', widget: 'select', default: 'urgent',
            options: [
              { label: 'Urgent (red)', value: 'urgent' },
              { label: 'Important (gold)', value: 'important' },
              { label: 'Notice (navy)', value: 'info' },
            ] },
          txt('message', 'Message', { hint: 'Keep it short — one or two sentences.' }),
          {
            label: 'Optional link', name: 'link', widget: 'object', collapsed: true,
            fields: [str('label', 'Link text (e.g. Read more)'), str('href', 'Link (e.g. /our-school/our-latest-news)')],
          },
          { label: 'Auto-hide after this date (optional)', name: 'expires', widget: 'datetime',
            required: false, date_format: 'YYYY-MM-DD', time_format: false, picker_utc: true,
            hint: 'The banner disappears on its own after this date — so you can\'t forget to remove it.' },
        ],
      },
      // technical fields — declared (as hidden) so Decap round-trips them
      // instead of dropping them when staff save Site settings.
      hidden('baseUrl'), hidden('web3formsKey'),
      str('name', 'School name'), str('motto', 'Motto (te reo Māori)'), txt('vision', 'Vision (English)'),
      {
        label: 'Addresses', name: 'address', widget: 'object', collapsed: true,
        fields: [
          { label: 'Physical address (one line per row)', name: 'physical', widget: 'list', field: str('line', 'Line') },
          { label: 'Postal address', name: 'postal', widget: 'list', field: str('line', 'Line') },
        ],
      },
      {
        label: 'Contact', name: 'contact', widget: 'object', collapsed: true,
        fields: [str('phone', 'Phone'), str('phoneHref', 'Phone link (tel:)'), str('fax', 'Fax'),
          str('email', 'Email'), str('attendanceEmail', 'Attendance email'),
          str('attendancePhone', 'Attendance phone'), str('attendancePhoneHref', 'Attendance phone link (tel:)')],
      },
      {
        label: 'External links', name: 'external', widget: 'object', collapsed: true,
        fields: [str('myRhc', 'My RHC'), str('schoolApp', 'School app'), str('adultEducation', 'Adult education'),
          str('facebook', 'Facebook'), str('instagram', 'Instagram')],
      },
      {
        label: 'Main navigation', name: 'nav', widget: 'list', collapsed: true, label_singular: 'Menu item', summary: '{{fields.label}}',
        fields: [str('label', 'Label'), str('href', 'Link (leave blank if it has a dropdown)'), {
          label: 'Dropdown items', name: 'children', widget: 'list', required: false, collapsed: true, summary: '{{fields.label}}',
          fields: [str('label', 'Label'), str('href', 'Link'), bool('external', 'Links to another website')],
        }],
      },
      {
        label: 'Footer quick links', name: 'footerLinks', widget: 'list', collapsed: true, summary: '{{fields.label}}',
        fields: [str('label', 'Label'), str('href', 'Link')],
      },
      str('copyright', 'Copyright line'),
    ],
  }],
};

const config = {
  backend: {
    name: 'github',
    repo: 'augustineynwa/rosehill-college-website',
    branch: 'main',
    // token exchange runs on our own Worker (cms-auth/) — GitHub's OAuth
    // secret can't live in the browser, and Netlify's proxy is Netlify-only
    base_url: 'https://rhc-cms-auth.fusion-588.workers.dev',
    auth_endpoint: 'auth',
    commit_messages: {
      create: 'Website edit: create {{collection}} “{{slug}}”',
      update: 'Website edit: update {{collection}} “{{slug}}”',
      delete: 'Website edit: delete {{collection}} “{{slug}}”',
      uploadMedia: 'Website edit: upload {{path}}',
      deleteMedia: 'Website edit: delete {{path}}',
    },
  },
  // only applies when the CMS is opened on localhost (with `npm run cms`
  // running); on the deployed site the GitHub backend above is used
  local_backend: true,
  media_folder: 'public/assets/img',
  public_folder: 'assets/img',
  publish_mode: 'simple',
  site_url: SITE_URL,
  logo_url: '/assets/img/RHC-Official-Crest.svg',
  collections: [
    settings,
    { name: 'pages', label: 'Pages', editor: { preview: false }, files },
  ],
};

mkdirSync(join(ROOT, 'public', 'admin'), { recursive: true });
const out = dump(config, { lineWidth: -1, noRefs: false, quotingType: '"' });
writeFileSync(join(ROOT, 'public', 'admin', 'config.yml'), out, 'utf8');
console.log(`Wrote public/admin/config.yml — ${files.length} pages, ${PAGE_TYPES.length} section types (${Math.round(out.length / 1024)} KB)`);
