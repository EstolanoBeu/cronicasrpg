import { cronicasrpg } from '../config.js'
import { prepRoll } from "../dice.js";
/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class CronicasActorSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["cronicasrpg", "sheet", "actor"],
      template: "systems/cronicasrpg/templates/actor/actor-sheet.html",
      width: 600,
      height: 600,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "descricao" }]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = super.getData();
    data.dtypes = ["String", "Number", "Boolean"];
    for (let attr of Object.values(data.data.atributos)) {
      attr.isCheckbox = attr.dtype === "Boolean";
    }
    for (let [key, atributo] of Object.entries(data.data.atributos)) {
      for (let [key, especializacao] of Object.entries(atributo.especializacoes)) {
        especializacao.label = game.i18n.localize(cronicasrpg.attributes[key]);
      }
      atributo.label = game.i18n.localize(cronicasrpg.attributes[key]);
    }

    // Prepare items.
    if (this.actor.data.type == 'character') {
      this._prepareCharacterItems(data);
    }

    return data;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterItems(sheetData) {
    const actorData = sheetData.actor;

    // Initialize containers.
    const virtudes = [];
    const fraquezas = [];
    const posses = [];

    // Iterate through items, allocating to containers
    for (let i of sheetData.items) {
      let item = i.data;
      i.img = i.img || DEFAULT_TOKEN;
      // Append to virtues.
      if (i.type == 'virtude') {
        virtudes.push(i);
      }
      // Append to weakness.
      if (i.type == 'fraqueza') {
        fraquezas.push(i);
      }
      // Append to goods.
      if (i.type == 'posse') {
        posses.push(i);
      }
    }

    // Assign and return
    actorData.virtudes = virtudes;
    actorData.fraquezas = fraquezas;
    actorData.posses = posses;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this));

    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.getOwnedItem(li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteOwnedItem(li.data("itemId"));
      li.slideUp(200, () => this.render(false));
    });

    // Rollable abilities.
    html.find('.rollable').click(this._onRoll.bind(this));

    // Drag events for macros.
    if (this.actor.owner) {
      let handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }


    for (let [key, atributo] of Object.entries(this.getData().data.atributos)) {
      if (localStorage.getItem('accordion-' + key) === 'true') {
        html.find('#accordion-' + key).click();
      }
      html.on('keyup keypress', function (e) {
        var keyCode = e.keyCode || e.which;
        if (keyCode === 13 && e.target.type != "textarea") {
          e.preventDefault();
        }
      });
      html.find('#accordion-' + key).on('click', function () {
        if (localStorage.getItem('accordion-' + key) === 'true') {
          localStorage.removeItem('accordion-' + key);
        } else {
          localStorage.setItem('accordion-' + key, true);
        }
      });
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `Nova ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      data: data
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data["type"];

    // Finally, create the item!
    return this.actor.createOwnedItem(itemData);
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async _onRoll(event, actor = null) {
    event.preventDefault();
    actor = !actor ? this.actor : actor;
    const a = event.currentTarget;
    const element = event.currentTarget;
    const dataset = element.dataset;
    const itemId = $(a).parents('.item').attr('data-item-id');
    let item = {
      roll: dataset.roll,
      label: dataset.label
    }

    if (itemId && ($(a).hasClass('virtude-rollable') || $(a).hasClass('fraqueza-rollable') || $(a).hasClass('posse-rollable') || $(a).hasClass('arma-rollable') || $(a).hasClass('armadura-rollable') || $(a).hasClass('ataque-rollable'))) {
      item = actor.getOwnedItem(itemId);
    }

    await prepRoll(event, item, actor);
  }
}
