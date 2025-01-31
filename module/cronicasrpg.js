// Import Modules
import { SystemSettings } from "./settings.js";
import { CronicasActor } from "./actor/actor.js";
import { CronicasActorSheet } from "./actor/actor-sheet.js";
import { CronicasItem } from "./item/item.js";
import { CronicasItemSheet } from "./item/item-sheet.js";
import { measureDistances } from "./canvas.js";
import * as dice from "./dice.js";

Hooks.once('init', async function () {

  game.cronicasrpg = {
    CronicasActor,
    CronicasItem,
    rollItemMacro,
    rollAttributeMacro
  };

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d6 + @combate.fisico.iniciativa",
    decimals: 2
  };

  // Register System Settings
  SystemSettings();

  // Define custom Entity classes
  CONFIG.Actor.entityClass = CronicasActor;
  CONFIG.Item.entityClass = CronicasItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("cronicasrpg", CronicasActorSheet, { makeDefault: true });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("cronicasrpg", CronicasItemSheet, { makeDefault: true });

  // If you need to add Handlebars helpers, here are a few useful examples:
  Handlebars.registerHelper('concat', function () {
    var outStr = '';
    for (var arg in arguments) {
      if (typeof arguments[arg] != 'object') {
        outStr += arguments[arg];
      }
    }
    return outStr;
  });

  Handlebars.registerHelper('toLowerCase', function (str) {
    return str.toLowerCase();
  });

  Handlebars.registerHelper("toJSONString", function (str) {
    return JSON.stringify(str);
  });

  Handlebars.registerHelper("ifEquals", function (arg1, arg2, options) {
    return arg1 == arg2 ? options.fn(this) : options.inverse(this);
  });

  Handlebars.registerHelper("ifNotEquals", function (arg1, arg2, options) {
    return arg1 != arg2 ? options.fn(this) : options.inverse(this);
  });

  Handlebars.registerHelper("ifGreater", function (arg1, arg2, options) {
    if (arg1 > arg2) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  Handlebars.registerHelper("ifEGreater", function (arg1, arg2, options) {
    if (arg1 >= arg2) {
      return options.fn(this);
    }
    return options.inverse(this);
  });

  Handlebars.registerHelper("ifLesser", function (arg1, arg2) {
    if (arg1 < arg2) {
      return true;
    }
    return false;
  });

});

Hooks.once("ready", async function () {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createCronicasMacro(data, slot));
});

/* -------------------------------------------- */
/*  Canvas Initialization                       */
/* -------------------------------------------- */

Hooks.on("canvasInit", function () {
  // Extend Diagonal Measurement
  canvas.grid.diagonalRule = game.settings.get("cronicasrpg", "diagonalMovement");
  SquareGrid.prototype.measureDistances = measureDistances;
});

/* -------------------------------------------- */
/*  Sidebar Initialization                       */
/* -------------------------------------------- */

Hooks.on("renderSidebarTab", async (object, html) => {
  var arrayTipoCombate = ["fisico", "mental", "social"];
  var tipoCombate = localStorage.getItem('tipoCombate');
  if (tipoCombate == "") {
    tipoCombate = arrayTipoCombate[0];
  }

  // Initiative according to combat type
  CONFIG.Combat.initiative.formula = "1d6 + @combate." + tipoCombate + ".iniciativa";

  // Creating Select on CombatTab
  var select = document.createElement('select');
  select.id = "selectTipoCombate";
  html.find('#combat-round').append(select);
  for (var i = 0; i < arrayTipoCombate.length; i++) {
    var option = document.createElement("option");
    option.value = arrayTipoCombate[i];
    option.text = game.i18n.localize("cronicasrpg." + arrayTipoCombate[i]);
    if (arrayTipoCombate[i] == tipoCombate) {
      option.selected = true;
    }
    select.appendChild(option);
  }
  // When the select value is changed
  select.onchange = function () {
    tipoCombate = select.value
    localStorage.setItem("tipoCombate", tipoCombate);
    CONFIG.Combat.initiative.formula = "1d6 + @combate." + tipoCombate + ".iniciativa"
  };

  if (object instanceof Settings) {
    let gamesystem = html.find("#game-details");
    // License text
    const template = "systems/cronicasrpg/templates/chat/license.html";
    const rendered = await renderTemplate(template);
    gamesystem.find(".system").append(rendered);

    // Site do Crônicas RPG
    let docs = html.find("button[data-action='docs']");
    const styling = "border:none;margin-right:2px;vertical-align:middle;margin-bottom:5px";
    $(`<button data-action="userguide"><i class="fas fa-dice"></i>Site do Crônicas RPG</button>`).insertAfter(docs);
    html.find('button[data-action="userguide"]').click(ev => {
      new FrameViewer('https://cronicasrpg.com.br/', { resizable: true }).render(true);
    });
  }
})

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */

export const getItemOwner = function (item) {
  if (item.actor) return item.actor;
  if (item._id) {
    return game.actors.entities.filter((o) => {
      return o.items.filter((i) => i._id === item._id).length > 0;
    })[0];
  }
  return null;
};

async function createCronicasMacro(data, slot) {
  if (data.type === "Atributo") {
    const item = data.data;
    const command = `game.cronicasrpg.rollAttributeMacro("${item.label}","${data.subtype}");`;
    let macro = game.macros.entities.find(
      (m) => m.name === item.label && m.command === command
    );
    if (!macro) {
      macro = await Macro.create({
        name: item.label,
        type: "script",
        command: command,
      });
    }
    game.user.assignHotbarMacro(macro, slot);
    return false;
  }
  if (data.type === "Item") {
    if (!("data" in data))
      return ui.notifications.warn(
        "Você só pode criar Macros para Atributos, ou Itens. Você pode referenciar atributos e perícias com @. Ex.: @for ou @luta"
      );
    const item = data.data;
    // const actor = getItemOwner(item);
    // Create the macro command
    let command = "";
    if (item.type === "arma") {
      command = `
//UTILIZE OS CAMPOS ABAIXO PARA MODIFICAR um ATAQUE
//VALORES SERÃO SOMADOS A CARACTEÍSTICA.
//INICIAR COM "=" SUBSTITUIRÁ O BÔNUS DA FICHA DA ARMA
game.cronicasrpg.rollItemMacro("${item.name}",{
           'atq' : "0",
      'dadoDano' : "",
          'dano' : "0", 
 'margemCritico' : "0",
   'multCritico' : "0",
       'pericia' : "",
      'atributo' : "",
          'tipo' : "",
       'alcance' : "",
         'custo' : "0",
          'nome' : "",
     'descricao' : ""
});`;
    } else {
      command = `game.cronicasrpg.rollItemMacro("${item.name}");`;
    }

    let macro = game.macros.entities.find(
      (m) => m.name === item.name && m.command === command
    );
    if (!macro) {
      macro = await Macro.create({
        name: item.name,
        type: "script",
        img: item.img,
        command: command,
        flags: {
          "cronicasrpg.itemMacro": true,
        },
      });
    }
    game.user.assignHotbarMacro(macro, slot);
    return false;
  }
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
async function rollItemMacro(itemName, extra = null) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  let item = null;
  if (extra) {
    item = actor
      ? actor.items.find(
        (i) => i.name === itemName && extra && i.type !== "arma"
      )
      : null;
  } else {
    item = actor ? actor.items.find((i) => i.name === itemName) : null;
  }
  if (!actor) return ui.notifications.warn(`Selecione um personagem.`);
  if (!item)
    return ui.notifications.warn(
      `O personagem selecionado não possui um Item chamado ${itemName}`
    );
  // Trigger the item roll
  await dice.prepRoll(event, item, actor, extra);
}

async function rollAttributeMacro(skillName, subtype) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  let skill;
  if (speaker.token) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  if (!actor) return ui.notifications.warn(`Selecione um personagem.`);
  if (subtype == "oficios") {
    for (let [t, sk] of Object.entries(actor.data.data.pericias["ofi"].mais)) {
      if (sk.label === skillName) {
        skill = sk;
        break;
      }
    }
  } else if (subtype == "custom") {
    for (let [t, sk] of Object.entries(actor.data.data.periciasCustom)) {
      if (sk.label === skillName) {
        skill = sk;
        break;
      }
    }
  } else {
    for (let [t, sk] of Object.entries(actor.data.data.pericias)) {
      if (sk.label === skillName) {
        skill = sk;
        break;
      }
    }
  }
  const item = {
    type: "attribute",
    label: attribute.label,
    roll: `1d6+${attribute.value}`,
  };
  // Trigger the item roll
  await dice.prepRoll(event, item, actor);
}