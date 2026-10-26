/* T3 DOM selector map: the ONE place that knows T3's markup.
 * Checked against T3 Code nightly 0.1.3 (2026-10-24). If T3 changes and a `required` hook stops matching,
 * the engine falls back to tokens only (colours/fonts, no transparent panels, no scene behind text). */
(function () {
  'use strict';
  window.T3SkinSelectors = {
    checkedAgainst: 'T3 Code nightly 0.1.3-nightly.20261024',
    // Layout hooks. `required` ones decide whether the full skin (transparent surfaces + scene) is safe.
    layout: {
      root: { sel: '#root', required: false },
      sidebarWrapper: { sel: "[data-slot='sidebar-wrapper']", required: true },
      sidebar: { sel: "[data-slot='sidebar']", required: false },
      sidebarContainer: { sel: "[data-slot='sidebar-container']", required: false },
      sidebarInner: { sel: "[data-slot='sidebar-inner']", required: false },
      sidebarPalette: { sel: '[data-app-sidebar]', required: false },
      sidebarFooter: { sel: "[data-slot='sidebar-footer']", required: false },
      sidebarStage: { sel: '.sidebar-stage-backdrop', required: false },
      sidebarBrand: { sel: ':has(> .sidebar-stage-backdrop)', required: false }, // brand row drawn white for T3's own stage art
      inset: { sel: "[data-slot='sidebar-inset']", required: true },
      header: { sel: '[data-chat-header]', required: false },
      chatColumn: { sel: '[data-chat-column]', required: false },
      chatCanvas: { sel: '[data-chat-canvas]', required: false },
      dropTarget: { sel: '[data-chat-workspace-drop-target]', required: false },
      composer: { sel: "[data-slot='composer-shell']", required: false },
      composerSurface: { sel: "[data-chat-composer-main-surface='true']", required: false },
      composerEditor: { sel: "[data-testid='composer-editor'], [data-slot='composer-shell'] textarea", required: false },
      composerAction: { sel: ":is([data-slot='composer-shell'], [data-chat-composer-transition-actions='true']) button:is([type='submit'], [aria-label='Resume thread'], [aria-label='Implementation actions'])", required: false },
      timelineRow: { sel: '[data-timeline-row-id]', required: false },
      details: { sel: '[data-thread-details-panel]', required: false },
      welcomeHeading: { sel: 'h1:has([data-draft-project-trigger])', required: false },
      projectTrigger: { sel: '[data-draft-project-trigger]', required: false },
      markdown: { sel: '.chat-markdown', required: false },
      codeblock: { sel: '.chat-markdown pre, .chat-markdown-codeblock', required: false },
      threadItem: { sel: '[data-thread-item]', required: false },
      activeThread: { sel: "[data-thread-item] [role='button'][aria-current='page'], [data-thread-item] [role='button'][aria-current='true']", required: false },
      menuButton: { sel: "[data-sidebar='menu-button'], [data-slot='sidebar-menu-button']", required: false },
      button: { sel: "button[data-slot='button'], [data-slot='toggle']", required: false }
    },
    // Opaque-by-design wrappers the skin makes transparent so the scene shows through.
    transparent: [
      '#root', "[data-slot='sidebar-wrapper']", "[data-slot='sidebar-inset']",
      'div.bg-background:has(> [data-chat-column])',
      '[data-chat-workspace-drop-target] > div.bg-background',
      '[data-chat-workspace-drop-target] > div > div.bg-background',
      '[data-chat-header]'
    ],
    // Text regions measured live and sent to the scene as safe zones (scene keeps calm there,
    // runtime adds a scrim). `area` zones are derived in engine.js (message lane, welcome hero).
    zones: {
      sidebar: "[data-slot='sidebar-container']",
      topbar: '[data-chat-header]',
      composer: "[data-slot='composer-shell']",
      details: '[data-thread-details-panel]',
      hero: 'h1:has([data-draft-project-trigger])'
    },
    // Lucide icon names T3 uses -> CSS selector. Themes may restyle or replace these.
    icons: {
      settings: 'svg.lucide-settings', search: 'svg.lucide-search', filter: 'svg.lucide-list-filter',
      'folder-plus': 'svg.lucide-folder-plus', 'new-thread': 'svg.lucide-square-pen', folder: 'svg.lucide-folder',
      plus: 'svg.lucide-plus', clip: 'svg.lucide-paperclip', brain: 'svg.lucide-brain', server: 'svg.lucide-server',
      branch: 'svg.lucide-git-branch-plus', 'pull-request': 'svg.lucide-git-pull-request-arrow',
      stats: 'svg.lucide-chart-no-axes-column', menu: 'svg.lucide-square-menu', ellipsis: 'svg.lucide-ellipsis',
      'panel-bottom': 'svg.lucide-panel-bottom', 'panel-right': 'svg.lucide-panel-right', clock: 'svg.lucide-clock',
      check: 'svg.lucide-check', chevron: 'svg.lucide-chevron-down', lock: 'svg.lucide-lock-open, svg.lucide-lock'
    },
    // Working / loading indicators.
    loaders: 'svg.lucide-circle-dashed, svg.lucide-loader, svg.lucide-loader-circle, svg.animate-spin',
    // Things the scene must never cover or restyle (menus/dialogs keep their own opaque surfaces).
    overlays: "[data-base-ui-portal], [role='dialog'], [role='menu'], [role='listbox']"
  };
})();
