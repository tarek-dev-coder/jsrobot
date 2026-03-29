/*jshint esversion: 6 */
define(['mozart', 'Behavior', 'Builder', 'Body'], function (mozart, behavior, Builder, Body) {
Behavior = behavior.B;

var player = new Behavior(function(bodyPriv, bodyPubl){

	if ('moveTo' in bodyPriv.properties) {
		var diff = bodyPriv.properties.moveTo.done - bodyPriv.properties.moveTo.total;
		if(bodyPriv.onGround && Math.abs(diff) > 0.1){
			if(Math.abs(bodyPriv.properties.moveTo.total) <= 10){
				if(Math.abs(diff) < 1){
					bodyPriv.k.x -= diff;
					bodyPriv.properties.moveTo.done -= diff;
				}else{
					bodyPriv.k.x += Math.sign(bodyPriv.properties.moveTo.total);
					bodyPriv.properties.moveTo.done += Math.sign(bodyPriv.properties.moveTo.total);
				}
			}else{
				bodyPriv.k.x += bodyPriv.properties.moveTo.total / 10;
				bodyPriv.properties.moveTo.done += bodyPriv.properties.moveTo.total / 10;
			}
		}
	}

	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	if(bodyPriv.k.t % 10 !== 0){ return; }
	//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

	bodyPriv.properties.events = [];

	if(bodyPubl.onGround()){
		bodyPriv.properties.events.push({event: 'ground'});
	}


	robotSprite = bodyPriv.getSprite("robot");
	gunSprite = bodyPriv.getSprite("gun");
	deadSprite = bodyPriv.getSprite("dead");
	winSprite = bodyPriv.getSprite("win");

	var turned = robotSprite.getInfo().fh?-1:1;// false: right, true: left

	bodyPubl.properties.facing = turned;

	document.getElementById('hud-coins').innerHTML = bodyPriv.properties.coins;
	document.getElementById('hud-battery').innerHTML = Math.max(0,(Math.round(bodyPriv.properties.energy * 10) / 10));
	document.getElementById('hud-health').innerHTML = Math.max(0,(Math.round(bodyPriv.properties.health * 10) / 10));

	if(bodyPriv.properties.health <= 0 || bodyPriv.properties.energy <= 0){
		robotSprite.hide();
		gunSprite.hide();
		winSprite.hide();
		deadSprite.show();
		return;
	}

	if(bodyPriv.properties.win){
		robotSprite.hide();
		gunSprite.hide();
		deadSprite.hide();
		winSprite.show();
		return;
	}

	if(bodyPubl.action){
		var action = bodyPubl.action;

		if(action.type == "jump"){
			if(bodyPubl.onGround()){
				amount = Number(action.amount) || 0;
				if(Math.abs(amount) > 10){amount = 10 * Math.sign(amount);}
				gunSprite.hide();
				robotSprite.show();
				bodyPriv.k.ax = amount/2;
				bodyPriv.k.ay = -15;
				bodyPriv.properties.energy -= (2 + Math.abs(amount)/20);
			}
		}else if(action.type == "move"){
			if(bodyPubl.onGround()){
				amount = Number(action.amount);
				if(Math.abs(amount) > 40){amount = 40 * Math.sign(amount);}
				gunSprite.hide();
				robotSprite.show();
				bodyPriv.properties.moveTo = {total: amount, done: 0};
				bodyPriv.properties.energy -= Math.abs(amount)/20;
			}
		}else if(action.type == "shoot"){
			gunSprite.show();
			robotSprite.hide();
			builder = bodyPriv.engine.priv.builder;
			builder.addToEngine(bodyPriv.engine.priv, "bullet",
				{x: bodyPriv.k.x + turned * 35,
					y: bodyPriv.k.y,
					vx: turned*10, t: engine.getTime()},[{r: Math.PI*(turned-1)/2}]);
			bodyPriv.properties.energy -= 1;
		}else if(action.type == "turn"){
			turned *= -1;
			robotSprite.fliph();
			deadSprite.fliph();
			gunSprite.fliph();
		}

		if(turned<0){
			gunSprite.setPos(-5,0);
		}else{
			gunSprite.setPos(5,0);
		}

		bodyPubl.action = null;
	}


	//bodyPriv.properties.action = null;
	var hideGlobals = `var window=undefined;
		var engine=undefined;
		var effects=undefined;
		var collide=undefined;
		var context=undefined;`;

	var disallowedCodeRegex = /\b(window|document|globalThis|self|parent|top|frames|eval|Function|XMLHttpRequest|fetch|WebSocket|localStorage|sessionStorage|IndexedDB)\b/;

	function isUserCodeSafe(code){
		if(!code || typeof code !== 'string') { return true; }
		return !disallowedCodeRegex.test(code);
	}

	var logging = `
		outputDiv = document.getElementById('output');
		function console_output(a, hr){
			if (outputDiv.innerHTML.split('<br>').length > 500) {
				outputDiv.innerHTML = outputDiv.innerHTML.split('<br>').slice(250,-1).join('<br>');
			}
			if (outputDiv.innerHTML != '' && hr !== true){
				outputDiv.innerHTML += '<hr>';
			} else if (hr === true) {
				outputDiv.innerHTML += '<br>';
			}
				outputDiv.innerHTML += a;
				outputDiv.scrollTop = outputDiv.scrollHeight;
		}
		console = {
			to_string: function(input, st) {
				if(input === undefined){return "undefined";}
				if(typeof(input) == 'object'){return JSON.stringify(input);}
				if(typeof(input) == 'function'){return input.toString()}
				if(st !== true && typeof(input) == 'string'){return '"' + input + '"';}
				return input;
			},
			log_nohr: function(a){
				console_output(console.to_string(a), true);
			},
			log: function(a){
				console_output(console.to_string(a));
			},
			log_in: function(a) {
				console_output('&rarr; ' + console.to_string(a, true));
			},
			log_out: function(a) {
				console_output('<b>&larr; ' + console.to_string(a) + '</b>', true);
			},
			error: function(a){
				setConsoleError(true);
				console_output('<i>' + a + '</i>');
			}
		};`;

	var scriptTail = `if(typeof(loop) == 'undefined'){
				loop = function(){}
			};
			if(typeof(init) == 'undefined'){
				init = function(){}
			};
			return {init: init, loop: loop};`;

	var requires = `
		var __requires__ = {};
		require = function(a){
			if(a in __requires__){
				return __requires__[a];
			}else{
				console.error('Error: "' + a + '" not found in files.');
			}
			return {};
		};
		var __requirefiles__ = Files.files();
		for(var i = 1; i < __requirefiles__.length; i++){
			var mod = Files.file(i);
			if(mod !== null && typeof(mod) == 'object' && 'text' in mod){
				var __module__ = new Function('var module = {};' + mod.text + '\\nreturn module.exports;');
				__requires__[__requirefiles__[i]] = __module__();
			}
		}
	`;

	if(typeof newcommand !== 'undefined' && newcommand !== ""){
		try{
			console.log_in(newcommand);
			if(!isUserCodeSafe(newcommand)){
				throw new Error('Disallowed keywords or browser API used in command');
			}

			if (undefined === bodyPriv._console_scope) {
				var ifrm = document.createElement("iframe");
				ifrm.style.width = "0px";
				ifrm.style.height = "0px";
				document.body.appendChild(ifrm);
				bodyPriv._console_scope = ifrm.contentWindow;
				bodyPriv._console_scope.robot = bodyPubl;
			}

			var userCommandFn = new Function('robot', 'Game', 'console', '"use strict"; ' + hideGlobals + newcommand);
			var commandResult = bodyPubl.command(function(console_scope){
				return userCommandFn.call(this, bodyPubl, Game, {
					log: console.log_nohr,
					error: console.error
				});
			}, bodyPriv._console_scope);

			if(keyboardControl){
				newcommand = "";
				return;
			}

			if(commandResult && commandResult.error === null){
				console.log_out(commandResult.output);
			}else if(commandResult && commandResult.error){
				console.error(commandResult.error.name + ': ' + commandResult.error.message);
			}
		} catch (err) {
			console.error(err.name + ": " + err.message);
		}

		newcommand = "";
	}

	if(typeof newcode !== 'undefined' && newcode && bodyPriv.k.t > 10){
		var userCode = (Files.file(0) && Files.file(0).text) ? Files.file(0).text : '';
		if(!isUserCodeSafe(userCode)){
			resetCode();
			console.error('Disallowed keywords or browser API used in script.');
			newcode = false;
		} else {
			try{
				var compileFn = new Function('"use strict"; ' + hideGlobals + requires + userCode + scriptTail);
				var moduleExports = compileFn();
				if(moduleExports && typeof moduleExports.init === 'function'){
					moduleExports.init(bodyPubl);
				}
				bodyPubl.playerCode = (moduleExports && typeof moduleExports.loop === 'function') ? moduleExports.loop : function(){};
			} catch (err) {
				resetCode();
				console.error(err.name + ': ' + err.message);
			}
			newcode = false;
		}
	}

	if(typeof resetcode !== 'undefined' && resetcode){
		bodyPubl.playerCode = function(){};
		bodyPubl.action = {type: 'wait'};
		resetcode = false;
	}
	if(propertiesDiv.style.display != "none"){
			customProperties = [];
			customFunctions = [];
			var keys = Object.keys(bodyPubl);
			for(var key of keys){
				if(key == 'step') continue;
				if(key == 'properties') continue;
				if(key == 'action') continue;
				if(typeof(bodyPubl[key]) == 'function'){
					customFunctions.push({key: key, value: bodyPubl[key]});
				}else{
					customProperties.push({key: key, value: bodyPubl[key]});
				}
			}
			customPropertiesString = "";
			for(var prop of customProperties){
				customPropertiesString += "<tr><td><b>" + prop.key + ": </b></td><td><b>" + JSON.stringify(prop.value) + "</b></td></tr>";
			}
			customFunctionsString = "";
			for(prop of customFunctions){
				if(prop.key == 'playerCode'){continue;}
				customFunctionsString += "<tr><td><b>" + prop.key + ": </b></td><td><b>" + prop.value.toString() + "</b></td></tr>";
			}

			propertiesDiv.innerHTML = "Robot = {<br><br><table>" +
			"<tr><td>energy: </td><td>" + (Math.round(bodyPriv.properties.energy * 10) / 10) + "</td></tr>" +
			"<tr><td>health: </td><td>" + (Math.round(bodyPriv.properties.health * 10) / 10) + "</td></tr>" +
			"<tr><td>coins: </td><td>" + bodyPriv.properties.coins + "</td></tr>" +
			"<tr><td>x: </td><td>" + (Math.round(bodyPriv.k.x * 10) / 10) + "</td></tr>" +
			"<tr><td>y: </td><td>" + (Math.round(bodyPriv.k.y * 10) / 10) + "</td></tr>" +
			"<tr><td>properties: </td><td>" + JSON.stringify(bodyPubl.properties) + "</td></tr>" +
			"<tr><td>action: </td><td>" + JSON.stringify(bodyPubl.action) + "</td></tr>" +

		  customPropertiesString +
			"<tr><td>&nbsp;</td><td></td></tr>" +
			"<tr><td>move: </td><td>[Built-in Function]</td></tr>" +
			"<tr><td>shoot:  </td><td>[Built-in Function]</td></tr>" +
			"<tr><td>jump: </td><td>[Built-in Function]</td></tr>" +
			"<tr><td>info: </td><td>[Built-in Function]</td></tr>" +
			"<tr><td>turn: </td><td>[Built-in Function]</td></tr>" +
			"<tr><td>init: </td><td>[Built-in Function]</td></tr>" +
			"<tr><td>loop: </td><td>[Built-in Function]</td></tr>" +
		  customFunctionsString +
		"</table><br>}";
}

},
// player collides with something
function(bodyPriv, bodyPubl, collideWith){

		if (!('events' in bodyPriv.properties)){
		 	 bodyPriv.properties.events = [];
		}

		if (collideWith === null ||
			 collideWith === undefined)
			return true;
 
		bodyPriv.properties.events = bodyPriv.properties.events.filter(function(a) {
			return (a.event !== 'collide' ||
				     ('with' in a			&&
					   'obj' in a.with	&&
				      a.with.obj !== collideWith.obj));
		});

		bodyPriv.properties.events.push({event: 'collide', with: collideWith});

		if(collideWith.t == 'spikes')
		{
			if('properties' in collideWith &&
			collideWith.properties !== null &&
			'spikesUp' in collideWith.properties &&
			collideWith.properties.spikesUp){
				bodyPriv.properties.health = 0;
				return false;
			}
			return true;
		}
		else if(collideWith.t == 'portal')
		{
			if('properties' in collideWith &&
				collideWith.properties !== null &&
				'portalDestination' in collideWith.properties &&
				collideWith.properties.portalDestination !== null){
					var a = collideWith.properties.portalDestination;
					var d = collideWith.properties.portalDestination.d;
				bodyPriv.k.x = a.x + (d%2) * (bodyPubl.info().width / 2 + 5) * ((d==3)?(-1):(1));
				bodyPriv.k.y = a.y + ((d+1)%2) * (bodyPubl.info().height / 2 + 5)* ((d === 0)?(-1):(1));
				bodyPriv.k.vx = 0;
				bodyPriv.k.vy = 0;
				// stop moving after going through portal
				bodyPriv.properties.moveTo.done = bodyPriv.properties.moveTo.total;
				return true;
			}
			return false;
		}
		else if(collideWith.t == 'battery')
		{
			if(isNaN(bodyPriv.properties.energy)){
				bodyPriv.properties.energy = 0;
			}
			bodyPriv.properties.energy = 100;
			return true;
		}
		else if(collideWith.t == 'coin')
		{
			if(isNaN(bodyPriv.properties.coins)){
				bodyPriv.properties.coins = 0;
			}
			bodyPriv.properties.coins += 1;
			return true;
		}
		else if(collideWith.t == 'flag')
		{
			if(isNaN(bodyPriv.properties.win)){
				bodyPriv.properties.win = true;
				getFlag();
			}
			return true;
		}
		else if(collideWith.t == 'sparkstrip')
		{
			if(isNaN(bodyPriv.properties.health)){
				bodyPriv.properties.health = 100;
			}
			bodyPriv.properties.health -= 60;
			effects.play("spark",{x: bodyPriv.k.x, y: bodyPriv.k.y});
			return false;
		}
		else if(collideWith.t == 'bullet')
		{
			if(isNaN(bodyPriv.properties.health)){
				bodyPriv.properties.health = 100;
			}
			bodyPriv.properties.health -= 10;
			return false;
		}
		else if(collideWith.t == 'lift')
		{
			bodyPriv.k.y += collideWith.k.vy;
			bodyPriv.k.x += collideWith.k.vx;
			//bodyPriv.k.vx == null;
			return 'skipX';
		}
		else if(collideWith.t == 'enemy')
		{
			if(isNaN(bodyPriv.properties.health)){
				bodyPriv.properties.health = 100;
			}
			if(collideWith.obj.properties.dead === false){
				bodyPriv.properties.health -= 2;
			}
			return false;
		}
		else{
			return false;
		}
});
return player;
});
