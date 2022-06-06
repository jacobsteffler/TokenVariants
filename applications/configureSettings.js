import { TVA_CONFIG, updateSettings } from '../scripts/settings.js';

export default class ConfigureSettings extends FormApplication {
  constructor() {
    super({}, {});
    this.settings = foundry.utils.deepClone(TVA_CONFIG);
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: 'token-variants-configure-settings',
      classes: ['sheet'],
      template: 'modules/token-variants/templates/configureSettings.html',
      resizable: false,
      minimizable: false,
      title: 'Configure Settings',
      width: 600,
      height: 'auto',
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.content', initial: 'searchPaths' }],
    });
  }

  async getData(options) {
    const data = super.getData(options);
    const settings = this.settings;

    data.v8 = (game.version ?? game.data.version).startsWith('0.8');

    // === Search Paths ===
    const paths = settings.searchPaths.map((path) => {
      const r = {};
      r.text = path.text;
      r.icon = this._pathIcon(path.text);
      r.cache = path.cache;
      return r;
    });
    data.searchPaths = paths;

    // === Search Filters ===
    data.searchFilters = settings.searchFilters;

    // === Algorithm ===
    data.algorithm = deepClone(settings.algorithm);
    data.algorithm.fuzzyThreshold = 100 - data.algorithm.fuzzyThreshold * 100;

    // === Randomizer ===
    // Get all actor types defined by the game system
    data.randomizer = deepClone(settings.randomizer);
    const actorTypes = (game.system.entityTypes ?? game.system.documentTypes)['Actor'];
    data.randomizer.actorTypes = actorTypes.reduce((obj, t) => {
      const label = CONFIG['Actor']?.typeLabels?.[t] ?? t;
      obj[t] = {
        label: game.i18n.has(label) ? game.i18n.localize(label) : t,
        disable: settings.randomizer[`${t}Disable`] ?? false,
      };
      return obj;
    }, {});

    data.randomizer.tokenToPortraitDisabled = !(
      settings.randomizer.tokenCreate || settings.randomizer.tokenCopyPaste
    );

    // === Pop-up ===
    data.popup = deepClone(settings.popup);
    // Get all actor types defined by the game system
    data.popup.actorTypes = actorTypes.reduce((obj, t) => {
      const label = CONFIG['Actor']?.typeLabels?.[t] ?? t;
      obj[t] = {
        type: t,
        label: game.i18n.has(label) ? game.i18n.localize(label) : t,
        disable: settings.popup[`${t}Disable`] ?? false,
      };
      return obj;
    }, {});

    // Split into arrays of max length 3
    let allTypes = [];
    let tempTypes = [];
    let i = 0;
    for (const [key, value] of Object.entries(data.popup.actorTypes)) {
      tempTypes.push(value);
      i++;
      if (i % 3 == 0) {
        allTypes.push(tempTypes);
        tempTypes = [];
      }
    }
    if (tempTypes.length > 0) allTypes.push(tempTypes);
    data.popup.actorTypes = allTypes;

    // === Permissions ===
    data.permissions = settings.permissions;

    // === Token HUD ===
    data.worldHud = deepClone(settings.worldHud);
    data.worldHud.tokenHUDWildcardActive = game.modules.get('token-hud-wildcard')?.active;

    // === Misc ===
    data.keywordSearch = settings.keywordSearch;
    data.excludedKeywords = settings.excludedKeywords;
    data.actorDirectoryKey = settings.actorDirectoryKey;
    data.runSearchOnPath = settings.runSearchOnPath;
    data.imgurClientId = settings.imgurClientId;
    data.enableStatusConfig = settings.enableStatusConfig;
    data.disableNotifs = settings.disableNotifs;

    return data;
  }

  /**
   * @param {JQuery} html
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Search Paths
    super.activateListeners(html);
    html.find('a.create-path').click(this._onCreatePath.bind(this));
    html.on('input', '.searchPath', this._onSearchPathTextChange.bind(this));
    $(html).on('click', 'a.delete-path', this._onDeletePath.bind(this));
    $(html).on('click', 'a.convert-imgur', this._onConvertImgurPath.bind(this));

    // Search Filters
    html.on(
      'input',
      'input[name="searchFilters.portraitFilterRegex"]',
      this._validateRegex.bind(this)
    );
    html.on(
      'input',
      'input[name="searchFilters.tokenFilterRegex"]',
      this._validateRegex.bind(this)
    );
    html.on(
      'input',
      'input[name="searchFilters.generalFilterRegex"]',
      this._validateRegex.bind(this)
    );

    // Algorithm
    const algorithmTab = $(html).find('div[data-tab="searchAlgorithm"]');
    algorithmTab.find(`input[name="algorithm.exact"]`).change((e) => {
      $(e.target)
        .closest('form')
        .find('input[name="algorithm.fuzzy"]')
        .prop('checked', !e.target.checked);
    });
    algorithmTab.find(`input[name="algorithm.fuzzy"]`).change((e) => {
      $(e.target)
        .closest('form')
        .find('input[name="algorithm.exact"]')
        .prop('checked', !e.target.checked);
    });
    algorithmTab.find('input[name="algorithm.fuzzyThreshold"]').change((e) => {
      $(e.target).siblings('.token-variants-range-value').html(`${e.target.value}%`);
    });

    // Randomizer
    const tokenCreate = html.find('input[name="randomizer.tokenCreate"]');
    const tokenCopyPaste = html.find('input[name="randomizer.tokenCopyPaste"]');
    const tokenToPortrait = html.find('input[name="randomizer.tokenToPortrait"]');
    const _toggle = () => {
      tokenToPortrait.prop(
        'disabled',
        !(tokenCreate.is(':checked') || tokenCopyPaste.is(':checked'))
      );
    };
    tokenCreate.change(_toggle);
    tokenCopyPaste.change(_toggle);

    const diffImages = html.find('input[name="randomizer.diffImages"]');
    const syncImages = html.find('input[name="randomizer.syncImages"]');
    diffImages.change(() => {
      syncImages.prop('disabled', !diffImages.is(':checked'));
    });

    // Token HUD
    html.find('input[name="worldHud.updateActorImage"]').change((event) => {
      $(event.target)
        .closest('form')
        .find('input[name="worldHud.useNameSimilarity"]')
        .prop('disabled', !event.target.checked);
    });
  }

  /**
   * Validates regex entered into Search Filter's RegEx input field
   */
  async _validateRegex(event) {
    if (this._validRegex(event.target.value)) {
      event.target.style.backgroundColor = '';
    } else {
      event.target.style.backgroundColor = '#ff7066';
    }
  }

  _validRegex(val) {
    if (val) {
      try {
        new RegExp(val);
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  /**
   * Converts Imgur path to a rolltable
   */
  async _onConvertImgurPath(event) {
    event.preventDefault();

    const searchPathInput = $(event.target).closest('.table-row').find('input.searchPath');

    const albumHash = searchPathInput.val().split(':')[1];
    const imgurClientId =
      TVA_CONFIG.imgurClientId === '' ? 'df9d991443bb222' : TVA_CONFIG.imgurClientId;

    fetch('https://api.imgur.com/3/gallery/album/' + albumHash, {
      headers: {
        Authorization: 'Client-ID ' + imgurClientId,
        Accept: 'application/json',
      },
    })
      .then((response) => response.json())
      .then(
        async function (result) {
          if (!result.success && location.hostname === 'localhost') {
            ui.notifications.warn(
              game.i18n.format('token-variants.notifications.warn.imgur-localhost')
            );
            return;
          }

          const data = result.data;

          let resultsArray = [];
          data.images.forEach((img, i) => {
            resultsArray.push({
              type: 0,
              text: img.title ?? img.description ?? '',
              weight: 1,
              range: [i + 1, i + 1],
              collection: 'Text',
              drawn: false,
              img: img.link,
            });
          });

          await RollTable.create({
            name: data.title,
            description:
              'Token Variant Art auto generated RollTable: https://imgur.com/gallery/' + albumHash,
            results: resultsArray,
            replacement: true,
            displayRoll: true,
            img: 'modules/token-variants/img/token-images.svg',
          });

          searchPathInput.val('rolltable:' + data.title).trigger('input');
        }.bind(this)
      )
      .catch((error) => console.log('Token Variant Art | ', error));
  }

  /**
   * Generates a new search path row
   */
  async _onCreatePath(event) {
    event.preventDefault();
    const table = $(event.currentTarget).closest('.token-variant-table');
    const row = `
    <li class="table-row flexrow">
        <div class="path-image">
            <i class="${this._pathIcon('')}"></i>
        </div>
        <div class="path-text">
            <input class="searchPath" type="text" name="searchPaths.text" value="" placeholder="Path to image source"/>
        </div>
        <div class="imgur-control">
            <a class="convert-imgur" title="Convert to Rolltable"><i class="fas fa-angle-double-left"></i></a>
        </div>
        <div class="path-cache">
            <input type="checkbox" name="searchPaths.cache" data-dtype="Boolean" checked/>
        </div>
        <div class="path-controls">
            <a class="delete-path" title="Delete path"><i class="fas fa-trash"></i></a>
        </div>
    </li>
  `;
    table.append(row);

    this.setPosition(); // Auto-resize window
  }

  async _onDeletePath(event) {
    event.preventDefault();
    const li = event.currentTarget.closest('.table-row');
    li.remove();

    this.setPosition(); // Auto-resize window
  }

  async _onSearchPathTextChange(event) {
    const image = this._pathIcon(event.target.value);
    const imgur = image === 'fas fa-info';

    const imgurControl = $(event.currentTarget).closest('.table-row').find('.imgur-control');
    if (imgur) imgurControl.addClass('active');
    else imgurControl.removeClass('active');

    $(event.currentTarget).closest('.table-row').find('.path-image i').attr('class', image);
  }

  // Return icon appropriate for the path provided
  _pathIcon(path) {
    const regexpForge = /(.*assets\.forge\-vtt\.com\/)(\w+)\/(.*)/;

    if (path.startsWith('s3:')) {
      return 'fas fa-database';
    } else if (path.startsWith('rolltable:')) {
      return 'fas fa-dice';
    } else if (path.startsWith('forgevtt:') || path.match(regexpForge)) {
      return 'fas fa-hammer';
    } else if (path.startsWith('imgur:')) {
      return 'fas fa-info';
    }

    return 'fas fa-folder';
  }

  /**
   * @param {Event} event
   * @param {Object} formData
   */
  async _updateObject(event, formData) {
    const settings = this.settings;
    formData = expandObject(formData);
    console.log(formData);

    // Search Paths
    const searchPaths = [];
    if (formData.searchPaths) {
      for (let i = 0; i < formData.searchPaths.text.length; i++) {
        if (formData.searchPaths.text[i] !== '') {
          searchPaths.push({
            text: formData.searchPaths.text[i],
            cache: formData.searchPaths.cache[i],
          });
        }
      }
    }
    settings.searchPaths = searchPaths;

    // Search Filters
    if (!this._validRegex(formData.searchFilters.portraitFilterRegex)) {
      formData.searchFilters.portraitFilterRegex = '';
    }
    if (!this._validRegex(formData.searchFilters.tokenFilterRegex)) {
      formData.searchFilters.tokenFilterRegex = '';
    }
    if (!this._validRegex(formData.searchFilters.generalFilterRegex)) {
      formData.searchFilters.generalFilterRegex = '';
    }
    mergeObject(settings.searchFilters, formData.searchFilters);

    // Algorithm
    formData.algorithm.fuzzyLimit = parseInt(formData.algorithm.fuzzyLimit);
    if (isNaN(formData.algorithm.fuzzyLimit) || formData.algorithm.fuzzyLimit < 1)
      formData.algorithm.fuzzyLimit = 50;
    formData.algorithm.fuzzyThreshold = (100 - formData.algorithm.fuzzyThreshold) / 100;
    mergeObject(settings.algorithm, formData.algorithm);

    // Randomizer
    mergeObject(settings.randomizer, formData.randomizer);

    // Pop-up
    mergeObject(settings.popup, formData.popup);

    // Permissions
    mergeObject(settings.permissions, formData.permissions);

    // Token HUD
    mergeObject(settings.worldHud, formData.worldHud);

    // Misc
    mergeObject(settings, {
      keywordSearch: formData.keywordSearch,
      excludedKeywords: formData.excludedKeywords,
      actorDirectoryKey: formData.actorDirectoryKey,
      runSearchOnPath: formData.runSearchOnPath,
      imgurClientId: formData.imgurClientId,
      enableStatusConfig: formData.enableStatusConfig,
      disableNotifs: formData.disableNotifs,
    });

    // Save settings
    updateSettings(settings);
  }
}