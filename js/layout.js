// persistent sidebar navigation; loaded as a plain <script> tag on every page.

(() => {

  // slug must exactly match the data-page attribute on the corresponding page's <body>
  const LINKS = [
    { slug: 'dashboard',  label: 'Dashboard',           href: './index.html',      icon: '&#8962;'  },
    { slug: 'workspace',  label: 'Workspace',           href: './workspace.html',  icon: '&#9998;'  },
    { slug: 'topics',     label: 'Composition Prompts', href: './topics.html',     icon: '&#9776;'  },
    { slug: 'idioms',     label: 'Idioms',              href: './idioms.html',     icon: '&#9783;'  },
    { slug: 'templates',  label: 'Templates',           href: './templates.html',  icon: '&#9733;'  },
    { slug: 'grammar',    label: 'Constructions',       href: './grammar.html',    icon: '&#9680;'  },
    { slug: 'gallery',    label: 'Gallery',             href: './gallery.html',    icon: '&#9638;'  },
    { slug: 'names',      label: 'Names',               href: './names.html',      icon: '&#10022;' },
    { slug: 'books',      label: 'Books',               href: './books.html',      icon: '&#9707;'  },
    { slug: 'links',      label: 'Links',               href: './links.html',      icon: '&#9903;'  },
  ];

  const STORAGE_KEY = 'scriptoribus.sidebarCollapsed';

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render() {
    const aside = document.getElementById('sidebar');
    if (!aside) return;

    const currentPage = document.body.dataset.page || '';

    // apply collapsed class synchronously to prevent a flicker before first paint
    if (localStorage.getItem(STORAGE_KEY) === 'true') {
      document.body.classList.add('sidebar-collapsed');
    }

    const linksHtml = LINKS.map(l => {
      const isActive = l.slug === currentPage;
      return `<a href="${l.href}"
           class="nav-link${isActive ? ' active' : ''}"
           title="${escapeHtml(l.label)}"
           ${isActive ? 'aria-current="page"' : ''}
        ><span class="nav-icon" aria-hidden="true">${l.icon}</span><span class="nav-label">${escapeHtml(l.label)}</span></a>`;
    }).join('');

    aside.innerHTML = `
      <div class="sidebar-header">
        <span class="site-title">Scriptoribus</span>
        <button class="sidebar-toggle" id="sidebar-toggle"
                title="Toggle sidebar" aria-label="Toggle sidebar">&#8942;</button>
      </div>
      <nav class="sidebar-nav" aria-label="Main navigation">${linksHtml}</nav>`;

    // all sidebar CSS rules target body.sidebar-collapsed, so toggling on <body> is enough
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      const collapsed = document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem(STORAGE_KEY, collapsed);
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
