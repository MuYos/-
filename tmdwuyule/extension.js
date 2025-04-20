game.import("extension",function(lib,game,ui,get,ai,_status){return {name:"tmdwuyule",content:function(config,pack){
},precontent:function(){
    // Ensure translations for the mark are set up early at game start
    if(!lib.skill._tmdwuyule_fandong_setup) { // Use a unique internal name
        lib.skill._tmdwuyule_fandong_setup = {
            trigger:{ global:'gameStart' },
            forced:true,
            firstDo:true, // Ensure it runs before other gameStart triggers if needed
            popup:false,
            priority:Infinity, // Run early
            content:function(){
                // Define translations if they don't exist
                if(!lib.translate.tmdwuyule_fandong) lib.translate.tmdwuyule_fandong = '反动';
                // Mark text should be "反动"
                if(!lib.translate.tmdwuyule_fandong_mark) lib.translate.tmdwuyule_fandong_mark = '反动'; 
                // No need for fandong_bg as it wasn't used
            }
        };
    }
},help:{},config:{},package:{
    character:{
        character:{
            "腊主席":["male","qun",4,["tuzhi", "wenge"],[]],
        },
        translate:{
            "腊主席":"腊主席",
            "tuzhi":"屠支",
            "wenge":"文革",
        },
    },
    card:{
        card:{
        },
        translate:{
        },
        list:[],
    },
    skill:{
        skill:{
            // Reimplemented 屠支 skill
            "tuzhi":{
                audio:"ext:tmdwuyule:1",
                mark:true, // Add mark:true here as well, just in case
                // Group all sub-skills
                group:['tuzhi_mark', 'tuzhi_damage', 'tuzhi_draw', 'tuzhi_use'],
                
                // Mark display properties moved to dedicated 'tmdwuyule_fandong' skill below
                
                // Sub-skills for each part of 屠支
                subSkill:{
                    // Game start part - add mark to a target
                    mark:{
                trigger:{
                            global:'gameStart',
                },
                        forced:true,
                filter:function(event, player){
                            return game.players.length > 1;
                        },
                content:function(){
                        'step 0'
                            player.chooseTarget('【屠支】：选择一名角色获得"反动"标记', true, function(card, player, target){
                            return true;
                            }).set('ai',function(target){
                            var player = _status.event.player;
                                // Target enemies, especially rebels
                                if(target.identity && target.identity == 'fan') return 10;
                                if(target.identity && target.identity == 'nei') return 5;
                            return -get.attitude(player, target);
                        });
                        'step 1'
                        if(result.bool && result.targets && result.targets.length){
                                var target = result.targets[0];
                                player.line(target, 'green');
                                player.logSkill('tuzhi', target);
                                // Add the mark with animation (using namespaced name)
                                target.addMark('tmdwuyule_fandong', 1);
                            game.log(target, '获得了', '#g"反动"标记');
                        }
                        },
                        sub:true,
                    },
                    // Damage increase part - YOU deal +1 damage to marked characters
                    damage:{
                        trigger:{
                            source:'damageBegin1',
                        },
                        filter:function(event, player){
                            // Only triggers when YOU (skill owner) damage a marked character (using namespaced name)
                            return event.player && event.player.hasMark('tmdwuyule_fandong');
                        },
                        forced:true,
                        content:function(){
                            game.log(player, '对持有"反动"标记的', trigger.player, '造成的伤害+1');
                            trigger.num++;
                        },
                        sub:true,
                    },
                    // Draw cards when marked characters take damage or lose HP
                    draw:{
                        trigger:{
                            global:['damageEnd', 'loseHpEnd'],
                        },
                        filter:function(event, player){
                            // Check if player has the mark and lost HP (either through damage or direct loss)
                            return event.player && event.player.hasMark('tmdwuyule_fandong') && event.num > 0;
                        },
                        forced:true,
                        content:function(){
                            // Draw cards equal to damage/HP loss amount
                            var num = trigger.num;
                            if(trigger.name == 'damage'){
                                game.log(player, '因', trigger.player, '持有"反动"标记受到', num, '点伤害，摸了', num, '张牌');
                            } else {
                                game.log(player, '因', trigger.player, '持有"反动"标记失去', num, '点体力，摸了', num, '张牌');
                            }
                            player.logSkill('tuzhi'); // This ensures the audio is played
                            player.draw(num);
                        },
                        sub:true,
                    },
                    // Allow marked players to use 杀 against skill owner at turn end (without distance limit)
                    use:{
                        trigger:{
                            global:'phaseJieshuBegin', // Trigger at the end of any player's turn
                        },
                        // No filter here, logic moved to content to check all players
                        forced:true, // Changed from direct, as it iterates
                        popup:false, // Don't show skill name popup for each iteration
                        content:function(){
                            'step 0'
                            // Get all players except the skill owner (player)
                            event.targetsToPrompt = game.filterPlayer(function(current){
                                return current != player;
                            }).sortBySeat();
                            event.skillOwner = player; // Store skill owner for AI

                            'step 1'
                            if(event.targetsToPrompt.length > 0){
                                event.current = event.targetsToPrompt.shift();
                                // Check if this player has the mark
                                if(event.current.hasMark('tmdwuyule_fandong') && event.current.canUse('sha', event.skillOwner, false)){ // Check if they can use sha
                                    // Prompt this player
                                    event.current.chooseToUse({
                                        name: 'sha',
                                        filterTarget: function(card, player, target){
                                            // Target must be the skill owner
                                            return target == _status.event.skillOwner;
                                        },
                                        selectTarget: -1,
                                        complexSelect: true,
                                        filterCard: function(card, player){
                                            return get.name(card) == 'sha';
                                        },
                                        position: 'hes', // Check hand and equip
                                        prompt: '【屠支】：你可以对'+get.translation(event.skillOwner)+'使用一张【杀】（无距离限制）',
                                        ai1: function(card){
                                            var source = _status.event.player; // The player choosing (event.current)
                                            var target = _status.event.skillOwner; // The skill owner (腊主席)

                                            // Loyalist ('zhong') should generally not attack 'qun' unless attitude is very negative
                                            if(source.identity == 'zhong'){
                                                return get.attitude(source, target) < -3 ? 1 : -1;
                                            }
                                            // Rebel ('fan') should attack 'qun'
                                            if(source.identity == 'fan'){
                                                return 9;
                                            }
                                            // Neutral ('nei') bases decision on standard effect calculation
                                            if(source.identity == 'nei'){
                                                return get.effect(target, {name:'sha'}, source, source);
                                            }
                                            // Default for other identities or if logic fails
                                            return get.attitude(source, target) < 0 ? 1 : -1;
                                        },
                                        ai2: function(target){
                                            return 1; // Only one possible target
                                        }
                                    }).set('logSkill', 'tuzhi').set('skillOwner', event.skillOwner); // Pass skillOwner to AI
                                    // Since chooseToUse is asynchronous, we don't immediately loop.
                                    // The loop continues in step 2 after the choice is made.
                                } else {
                                    // If current player doesn't have the mark or cannot use sha, skip to next player
                                    event.goto(1);
                                }
                            } else {
                                // No more players to prompt
                                event.finish();
                            }
                            'step 2'
                            // After chooseToUse resolves (or if skipped in step 1), loop back to prompt next player
                            event.goto(1);
                        },
                        sub:true,
                    },
                }
            },
            
            // Reimplemented 文革 skill with better AI logic and no distance limit for 杀
            "wenge":{
                enable:"phaseUse",
                usable:1,
                audio:"ext:tmdwuyule:4",
                filter:function(event, player){
                    // Check for players without the namespaced mark
                    return player.maxHp > 1 && player.hp > 0 && game.hasPlayer(function(current){
                        return current != player && !current.hasMark('tmdwuyule_fandong');
                    });
                },
                content:function(){
                    'step 0'
                    // Lose maxHp first
                    player.loseMaxHp();
                    
                    // Get all players without 反动 mark (using namespaced name)
                    var potentialTargets = game.filterPlayer(function(current){
                        return current != player && !current.hasMark('tmdwuyule_fandong');
                    }).sortBySeat(player);
                    
                    // Limit to at most X targets, where X is player's health value
                    var maxTargets = player.hp;
                    
                    // Let player choose which targets to affect, up to their hp value
                    if(potentialTargets.length > maxTargets) {
                        player.chooseTarget('【文革】：选择至多' + maxTargets + '名角色', 
                            [1, maxTargets], function(card, player, target){
                                return target != player && !target.hasMark('tmdwuyule_fandong');
                            }).set('ai', function(target){
                                var player = _status.event.player;
                                // Prioritize enemies, especially rebels
                                if(target.identity === 'fan') return 10;
                                return -get.attitude(player, target);
                            });
                    } else {
                        // If there are fewer potential targets than hp, use all of them
                        event.list = potentialTargets;
                        event.goto(2); // Skip to processing targets directly
                    }
                    
                    'step 1'
                    // If player chose targets, use those
                    if(result.bool && result.targets && result.targets.length) {
                        event.list = result.targets;
                    } else {
                        // If player somehow didn't choose (shouldn't happen unless canceled)
                        event.finish();
                        return;
                    }
                    
                    'step 2'
                    // If no more players to process, end the skill
                    if(event.list.length == 0) {
                        event.finish();
                        return;
                    }
                    
                    // Get the next player to make a choice
                    var current = event.list.shift();
                    event.current = current;
                    
                    // Check if they can use 杀 on a marked target (using namespaced name)
                    var canUseSha = game.hasPlayer(function(target){
                        return target.hasMark('tmdwuyule_fandong');
                    }) && current.countCards('h', {name:'sha'}) > 0;
                    
                    // Set up choice options
                    var choices = ['获得一枚"反动"标记'];
                    if(canUseSha) choices.push('对一名有"反动"标记的角色使用一张【杀】');
                    
                    current.chooseControl(choices).set('prompt', get.translation(player) + '发动了【文革】，请选择').set('ai', function(){
                        var player = _status.event.player; // Current player making choice
                        var skillOwner = _status.event.getParent().player; // Player who used 文革
                        
                        // If current player is rebel, prefer gaining mark
                        if(player.identity === 'fan') return '获得一枚"反动"标记';
                        
                        // If current player is loyalist, prefer using 杀 on rebels
                        if(player.identity === 'zhong' && choices.length > 1){
                            var targets = game.filterPlayer(function(target){
                                // Check namespaced mark
                                return target.hasMark('tmdwuyule_fandong') && 
                                       target.identity === 'fan';
                            });
                            if(targets.length > 0) return '对一名有"反动"标记的角色使用一张【杀】';
                        }
                        
                        // Neutral players decide based on benefit
                        if(player.identity === 'nei' && choices.length > 1){
                            var targets = game.filterPlayer(function(target){
                                // Check namespaced mark
                                return target.hasMark('tmdwuyule_fandong') && 
                                       get.effect(target, {name:'sha'}, player, player) > 0;
                            });
                            if(targets.length > 0) return '对一名有"反动"标记的角色使用一张【杀】';
                        }
                        
                        // Default choice
                        return '获得一枚"反动"标记';
                    });
                    
                    'step 3'
                    // Handle player's choice
                    if(result.control === '获得一枚"反动"标记'){
                        // Add namespaced mark
                        event.current.addMark('tmdwuyule_fandong', 1);
                        game.log(event.current, '选择获得一枚', '#g"反动"标记');
                        // Process next player
                        event.goto(2);
                    }
                    else{
                        // Choose target for 杀 without distance limitation (check namespaced mark)
                        event.current.chooseTarget('选择一名有"反动"标记的角色', function(card, player, target){
                            return target.hasMark('tmdwuyule_fandong');
                        }).set('ai', function(target){
                            var player = _status.event.player;
                            
                            // Prioritize based on identity
                            if(player.identity === 'zhong' && target.identity === 'fan') return 10;
                            if(player.identity === 'fan' && target.identity === 'zhong') return -10;
                            
                            // Default targeting logic
                            return get.effect(target, {name:'sha'}, player, player) * 
                                   (get.attitude(player, target) < 0 ? 2 : 1);
                        });
                    }
                    
                    'step 4'
                    // If chose to use 杀 and selected a target, use 杀 without distance limitation
                    if(result.bool && result.targets && result.targets.length){
                        var card = {name:'sha', isCard:true};
                        event.current.useCard(card, result.targets[0], false).set('addCount', false).set('logSkill', 'wenge');
                    }
                    else if(result.control !== '获得一枚"反动"标记'){
                        // Fallback to getting mark if player didn't select a target (add namespaced mark)
                        event.current.addMark('tmdwuyule_fandong', 1);
                        game.log(event.current, '未选择目标，改为获得一枚', '#g"反动"标记');
                    }
                    // Process next player
                    event.goto(2);
                },
                ai:{
                    order:4,
                    result:{
                        player:function(player){
                            if(player.maxHp <= 1) return -10;
                            
                            // Count potential targets (check namespaced mark)
                            var unmarkedPlayers = game.filterPlayer(function(current){
                                return current != player && !current.hasMark('tmdwuyule_fandong');
                            });
                            
                            if(unmarkedPlayers.length == 0) return -1;
                            
                            // Count enemy rebels (check namespaced mark)
                            var enemyRebels = game.filterPlayer(function(current){
                                return current.identity === 'fan' && !current.hasMark('tmdwuyule_fandong');
                            });
                            
                            // If player is loyalist and there are rebels, use this
                            if(player.identity === 'zhong' && enemyRebels.length > 0) return 3;
                            
                            // Otherwise only use if enough targets and health
                            return player.maxHp > 2 ? 1 : -1;
                        }
                    }
                }
            },
            
            // Dedicated skill for 'tmdwuyule_fandong' mark display (namespaced)
            "tmdwuyule_fandong":{
                mark:true,
                marktext:"反动", // Corrected display text
                intro:{
                    name:"反动", // Display text remains the same
                    // Use a function for content to be more explicit
                    content:function(storage){
                        // storage should be the number of marks (usually 1 here)
                        if(storage > 0) return '持有"反动"标记';
                        return '没有"反动"标记'; // Fallback text
                    }
                }
                // Note: No charlotte, popup, forced needed here as it's just for display
            },
            
            // Wenge skill definition was duplicated, removing the second one.
        },
        translate:{
            "tuzhi":"屠支",
            "tuzhi_info":"游戏开始时，你令一名角色获得1枚\"反动\"标记。你对有\"反动\"标记的角色造成的伤害+1。每当有\"反动\"标记的角色受到1点伤害或失去1点体力时，你摸1张牌。每名角色的回合结束时，若该角色有\"反动\"标记，其可以对你使用一张【杀】（无距离限制）。",
            "wenge":"文革",
            "wenge_info":"出牌阶段限一次，你可以减1点体力上限，然后选择至多X名角色（X为你的体力值）未持有\"反动\"标记的角色令其选择：1.获得1枚\"反动\"标记；2.或对任意一名已有\"反动\"标记的角色使用一张【杀】（无距离限制）（若其无法如此做或放弃，则视为选择1）。",
            // Update translation keys for the namespaced mark
            "tmdwuyule_fandong":"反动", // Display name
            "tmdwuyule_fandong_mark":"反动", // Corrected Mark text translation
        },
    },
    intro:"",
    author:"无名玩家",
    diskURL:"",
    forumURL:"",
    version:"1.0",
},files:{"character":["腊主席.jpg"],"card":[],"skill":[],"audio":["1.mp3", "2.mp3", "3.mp3", "4.mp3"]}}})

