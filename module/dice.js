/* Standardized Roll Script */
export async function prepRoll(event, item, actor = null, actionType = {}) {
    actor = !actor ? this.actor : actor;
    // Initialize variables.
    event.preventDefault();

    let formula = item.roll;
    let flavorText = item.label;
    let rollMode = game.settings.get("core", "rollMode");
    let itemDt;

    if (item.data) {
        itemDt = item.data.data
    }

    let templateData = {
        title: flavorText,
        rollMode: rollMode,
        rollModes: CONFIG.Dice.rollModes,
    };

    if (itemDt && itemDt.dano && (actionType === 'padrao' || actionType === 'total' || actionType === 'multiplo')) {
        templateData.rollDano = actor.data.data.atributos[itemDt.atributoDano].total;
        templateData.rollDano += itemDt.dano;
    }

    if (formula) {

        if (itemDt) {
            if ((itemDt.ruimDeBloqueio) && (actionType === 'bloqueio' || actionType === 'bloqueioMaior')) {
                formula += '-1S';
            } else if ((itemDt.complicada) && (actionType === 'padrao' || actionType === 'total' || actionType === 'multiplo')) {
                formula += '-1D';
            }
        }

        formula = formula
            .replace(/ /g, "")
            .replace(/\+0/g, "")
            .replace(/\-0/g, "")
            .replace(/\++/g, "+");

        if (!event.shiftKey || actionType === 'iniciativa') {
            rollCronicas(formula, actor, templateData, actionType);
        } else {
            templateData.formula = formula;
            templateData.rollMode = rollMode;
            let dialogCallback = (html) => {
                rollMode = html.find('[name="rollMode"]').val();
                let rollMod = html.find('[name="mod"]').val();
                if (
                    rollMod.length > 0 &&
                    rollMod.trim().charAt(0) != "+" &&
                    rollMod.trim().charAt(0) != "-"
                )
                    rollMod = "+" + rollMod;
                formula = formula + rollMod;
                rollCronicas(formula, actor, templateData, actionType);
            };
            return new Promise((resolve) => {
                renderTemplate("systems/cronicasrpg/templates/chat/roll-dialog.html", templateData).then((dlg) => {
                    new Dialog({
                        title: game.i18n.localize("cronicasrpg.rolagemDe") + " " + flavorText,
                        content: dlg,
                        buttons: {
                            normal: {
                                label: game.i18n.localize("cronicasrpg.rolar"),
                                callback: (html) => {
                                    resolve(dialogCallback(html));
                                },
                            },
                        },
                        default: "normal",
                        close: () => {
                            // noop
                        },
                    }).render(true);
                });
            });
        }
    } else {
        templateData.title = item.name;
        templateData.details = item.data.data.descricao;
        rollCronicas(formula, actor, templateData, actionType);
    }
}


function rollCronicas(roll, actor, templateData, actionType = {}) {
    // Render the roll
    let template = "systems/cronicasrpg/templates/chat/chat-card.html";
    // GM rolls.
    let combate = game.combats.active;

    let chatData = {
        user: game.user._id,
        speaker: ChatMessage.getSpeaker({
            actor: actor,
        }),
        flags: { "core.canPopout": true },
    };

    let rollMode = game.settings.get("core", "rollMode");
    if (templateData.rollMode) {
        rollMode = templateData.rollMode;
    }

    if (["gmroll", "blindroll"].includes(rollMode))
        chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user._id];
    if (rollMode === "blindroll") chatData["blind"] = true;

    // Handle dice rolls.
    let formula = "";
    let result;
    let dificuldade = 0;

    let rollTemplate = {
        template: "systems/cronicasrpg/templates/chat/cronicaroll.html",
    };

    if (roll) {
        //Changing all empty dices to d6
        roll = roll.replace(/[Dd][\+]/g, "d6+").replace(/[Dd][\-]/g, "d6-").replace(/[Dd]$/g, "d6");
        //counting success
        roll = roll.trim().replace(/([\+])/g, " +").replace(/([\-])/g, " -");
        const dados = roll.split(" ");
        roll = "";
        dados.forEach(function (dado) {
            if (dado.match(/.*[sS].*/g)) {
                dado = dado.replace(/([sS])/g, "");
                dificuldade += Number(dado);
            }
            else {
                if (templateData.title == null || (actionType === "iniciativa" && !dado.includes("d"))) {
                    roll += dado;
                } else {
                    let quantidade = dado.split("d")[0];
                    for (let i = 0; i < quantidade; i++) {
                        roll += "+1d6";
                    }
                }
            }
        })

        templateData.dificuldade = dificuldade;

        if (roll.match(/(\d*)d\d+/g)) {
            formula = roll;
        } else if (Number(roll) !== NaN) {
            formula = null;
            result = new Roll(roll).roll();
        }
        if (formula != null) {
            let roll = new Roll(`${formula}`);
            roll.roll();
            result = roll.results[0];

            if (templateData.title != null && actionType === "iniciativa" && combate) {
                let combatente = combate.combatants.find(
                    (combatant) => combatant.actor.id === actor.id
                );
                if (combatente && combatente.iniciative == null) {
                    combate.setInitiative(combatente._id, roll.total);
                    console.log(
                        "Foundry VTT | Iniciativa Atualizada para " +
                        combatente._id +
                        " (" +
                        combatente.actor.name +
                        ")"
                    );
                }
            }

            chatData.roll = roll;

            // Render it.
            roll.render(rollTemplate).then((r) => {
                templateData.roll = r;
                renderTemplate(template, templateData).then((content) => {
                    chatData.content = content;
                    if (game.dice3d) {
                        game.dice3d
                            .showForRoll(
                                roll,
                                game.user,
                                true,
                                chatData.whisper,
                                chatData.blind
                            )
                            .then((displayed) => ChatMessage.create(chatData));
                    } else {
                        chatData.sound = CONFIG.sounds.dice;
                        ChatMessage.create(chatData);
                    }
                });
            });
        } else {
            result.render(rollTemplate).then((r) => {
                templateData.roll = r;
                renderTemplate(template, templateData).then((content) => {
                    chatData.content = content;
                    ChatMessage.create(chatData);
                });
            });
        }
    } else {
        renderTemplate(template, templateData).then((content) => {
            chatData.content = content;
            ChatMessage.create(chatData);
        });
    }
}

/* Add hook to calculate number of success and change the total of the roll */
Hooks.on('renderChatMessage', (message, html, data) => {
    if (!message.roll || message.data.content.includes(game.i18n.localize("cronicasrpg.iniciativa"))) return;
    if (message.data.flavor && message.data.flavor.includes("Initiative")) return;

    const dados = message.roll.results;
    let sucessos = Number(html.find('.valor-dificuldade').text());
    let critico = false;
    let falha = false;
    let sucessoMsg = game.i18n.localize("cronicasrpg.sucessoMsgPlural");

    dados.forEach(function (result) {
        if (result === 1) {
            falha = true;
        }
        else if (result === 4 || result === 5) {
            sucessos++;
        } else if (result === 6) {
            sucessos++;
            critico = true;
        }
    });

    if (sucessos === 1) {
        sucessoMsg = game.i18n.localize("cronicasrpg.sucessoMsgSingular");
    }
    else if (sucessos === 0 && falha) {
        html.find('.dice-total').css({ 'color': 'red' });
    }

    if (critico) {
        html.find('.dice-total').css({ 'color': 'green' });
    }

    var newTotal = sucessos + ' ' + sucessoMsg;
    html.find('.dice-total').empty().append(newTotal);
});
