//#region TBAC
/*globals Tbac */
(function($) {


	"use strict";
	var EventEmitter = (function() {


		var splitter = /\s+/,
			nextTick = getNextTick();

		return {
			onSync: onSync,
			onAsync: onAsync,
			off: off,
			trigger: trigger
		};

		function on(method, types, cb, context) {
			var type;

			if (!cb) {
				return this;
			}

			types = types.split(splitter);
			cb = context ? bindContext(cb, context) : cb;

			this._callbacks = this._callbacks || {};

			while (type = types.shift()) {
				this._callbacks[type] = this._callbacks[type] || {
					sync: [],
					async: []
				};
				this._callbacks[type][method].push(cb);
			}

			return this;
		}

		function onAsync(types, cb, context) {
			return on.call(this, 'async', types, cb, context);
		}

		function onSync(types, cb, context) {
			return on.call(this, 'sync', types, cb, context);
		}

		function off(types) {
			var type;

			if (!this._callbacks) {
				return this;
			}

			types = types.split(splitter);

			while (type = types.shift()) {
				delete this._callbacks[type];
			}

			return this;
		}

		function trigger(types) {
			var type, callbacks, args, syncFlush, asyncFlush;

			if (!this._callbacks) {
				return this;
			}

			types = types.split(splitter);
			args = [].slice.call(arguments, 1);

			while ((type = types.shift()) && (callbacks = this._callbacks[type])) {
				syncFlush = getFlush(callbacks.sync, this, [type].concat(args));
				asyncFlush = getFlush(callbacks.async, this, [type].concat(args));

				syncFlush() && nextTick(asyncFlush);
			}

			return this;
		}

		function getFlush(callbacks, context, args) {
			return flush;

			function flush() {
				var cancelled;

				for (var i = 0, len = callbacks.length; !cancelled && i < len; i += 1) {
					// only cancel if the callback explicitly returns false
					cancelled = callbacks[i].apply(context, args) === false;
				}

				return !cancelled;
			}
		}

		function getNextTick() {
			var nextTickFn;

			// IE10+
			if (window.setImmediate) {
				nextTickFn = function nextTickSetImmediate(fn) {
					setImmediate(function() {
						fn();
					});
				};
			}

			// old browsers
			else {
				nextTickFn = function nextTickSetTimeout(fn) {
					setTimeout(function() {
						fn();
					}, 0);
				};
			}

			return nextTickFn;
		}

		function bindContext(fn, context) {
			return fn.bind ?
				fn.bind(context) :
				function() {
					fn.apply(context, [].slice.call(arguments, 0));
				};
		}
	})();

	var Datasett = (function() {

		var noop = function() {};
		var cache = {};
		var defaults = {
			label: 'datasett',
			type: '',
			key: '',
			url: '',
			prside: 50,
			query: '',
			filter: '',
			felt: ["id", "navn"],
			sortering: '',
			sortdir: 1,
			data: {
				length: 0
			},
			events: {
				onDataLoading: "onDataLoading",
				onDataLoaded: "onDataLoaded",
				onTotaltChanged: "onTotaltChanged"
			},
			scorer: noop,
			matcher: noop,
			sorter: noop,
		};

		function Datasett(options) {

			var o = this.o = $.extend(true, {}, defaults, options)

			$.extend(true, this, o);
		}


		Datasett.prototype = {
			constructor: Datasett,
			crop: function(range) {
				range.from = Math.max(0, range.from);
				range.to = Math.min(this.data.length, range.to);
				return range;
			},
			normaliser: function(range) {
				if (typeof range === "undefined")
					return {
						from: 0,
						to: this.data.length
					};
				if (typeof range === "number")
					return {
						from: range,
						to: this.data.length
					};
				//$.error("Må oppgi parameter til normaliserRange på formen {from|top: 0, to|bottom: 10}");
				if (typeof range.from === "undefined")
					return {
						from: range.top,
						to: range.bottom
					};

				return range;
			},
			onError: function(fromPage, toPage) {
				$.error("error loading pages " + fromPage + " to " + toPage);
			},
			isLoaded: function(range) {
				var data = this.data;
				range = this.normaliser(range);
				for (var i = range.from; i <= range.to; i++)
					if (data[i] === undefined || data[i] == null)
						return false;
				return true;
			},
			clear: function() {
				var data = this.data;
				for (var k in data)
					delete data[k];
				data.length = 0;
			},
			reload: function(range) {
				var data = this.data;
				range = this.normaliser(range);
				for (var i = range.from; i <= range.to; i++)
					delete data[i];

				this.ensure(range);
			},
			ensure: function(range) {
				range = this.crop(this.normaliser(range));
				this.trigger(this.events.onDataLoaded, range);
			},

			get: function(range) {
				range = this.normaliser(range);
				return Array.prototype.slice.call(this.data, range.from, range.to - range.from);
			},

			find: function(fn) {
				var data, _fn;
				data = this.data;
				_fn = !$.isFunction(fn) ? fn : function(p) {
					return p.id === fn;
				};
				for (var i = 0, l = data.length; i < l; i++) {
					if (fn(data[i], i))
						return data[i];
				}
			},

			insert: function(range, nytt) {
				var added = 0,
					data = this.data,
					events = this.events,
					teller = 0;

				nytt = !$.isArray(nytt) ? [nytt] : nytt;
				range = typeof range === "number" ? {
					from: range,
					to: range + nytt.length
				} : this.normaliser(range);

				for (var i = range.from; i < range.to; i++) {

					if (teller >= nytt.length)
						return $.error("IndexOutOfRange");

					if (i > data.length) {
						data[i] = nytt[teller++];
						added++;
					} else if (data[i] === undefined || data[i] == null)
						data[i] = nytt[teller++];
				}

				data.length += added;
				if (added)
					this.trigger(this.events.onTotaltChanged, {
						previous: data.length - added,
						current: data.length
					});
			},

			add: function(items) {
				// var data = this.data, events = this.events;
				// Array.prototye.push.apply(this.data, items);
				// this.totalt = data.length;
				// this.trigger(events.onTotaltChanged);
				var range = {
					from: this.data.length,
					to: this.data.length + items.length
				};
				this.insert(range, items);
			},

			setLabel: function(nytt) {
				this.label = nytt;
			},

			setSort: function(column, dir) {
				if (this.sortering.toLowerCase() === column.toLowerCase() && (dir === undefined || dir === this.sortdir))
					return;
				this.sortering = column;
				this.sortdir = dir;
				this.clear();
			},

			setFilter: function(nytt) {
				if (this.filter === String(nytt))
					return;
				this.filter = String(nytt);
				this.clear();
			},

			setSearch: function(str) {
				if ($.trim(this.query) === $.trim(str + ''))
					return;
				if (str.indexOf(this.query) >= 0) {
					console.log(str + " er subquery til " + this.query);
				}
				this.query = str;
				this.clear();
			}
		};

		$.extend(true, Datasett.prototype, EventEmitter);

		return Datasett;

	}());

	var Source = (function() {

		var noop = function() {};

		var defaults = {
			type: '',
			url: 'tbac_bs.asp',
			prside: 50,
			query: "",
			filter: "",
			felt: ["id", "navn"],
			sortcol: '',
			sortdir: 1,
			label: '',
			scorer: noop,
			matcher: noop,
			sorter: noop,
			key: ''
		};

		function Source(options) {
			// private
			var o = $.extend(true, {}, defaults, options || {});
			var type = o.type;
			var PAGESIZE = o.prside || 50;
			var data = {
				length: 0
			};

			var key = o.key;
			var url = o.url;
			var query = o.query || "";
			var filter = o.filter || '';
			var felt = o.felt || ["id", "navn"];
			var sortcol = o.sortering || null;
			var sortdir = 1;

			var throttleTimer = null;
			var req = null; // ajax request

			// events
			var events = {
				onDataLoading: "onDataLoading",
				onDataLoaded: "onDataLoaded",
				onTotaltChanged: "onTotaltChanged"
			};

			var label = o.label || '';

			function init() {}

			function normaliser(range) {
				if (typeof range === "undefined")
					return {
						from: 0,
						to: data.length
					};
				if (typeof range === "number")
					return {
						from: range,
						to: data.length
					};
				//$.error("Må oppgi parameter til normaliserRange på formen {from|top: 0, to|bottom: 10}");
				if (typeof range.from === "undefined")
					return {
						from: range.top,
						to: range.bottom
					};

				return range;
			}

			function onError(fromPage, toPage) {
				$.error("error loading pages " + fromPage + " to " + toPage);
			}

			function onSuccess(range, resp) {
				var from, to, kolonner, totalt, mapper, s, antall, teller, old;

				s = resp.split('|$|');
				from = req.fromPage * PAGESIZE;

				kolonner = felt.slice(0);
				totalt = parseInt(s[s.length - 1], 10);
				antall = Math.ceil((s.length - 2) / kolonner.length);
				to = from + antall;
				teller = -1;

				mapper = function(index) {

					var post = {
						index: index
					};
					kolonner.forEach(function(kol, j) {
						post[kol] = s[index + j];
					});

					data[from + index] = post;
				};

				for (var i = 0, k = kolonner.length, l = (s.length - 2); i < l; i += k)
					mapper(teller++);

				old = data.length;
				data.length = totalt;
				if (old !== totalt)
					this.trigger(events.onTotaltChanged, {
						previous: old,
						current: totalt
					});



				this.trigger(events.onDataLoaded, {
					range: range,
					query: query,
					data: data
				});

				return data;

			}

			function isLoaded(range) {
				range = normaliser(range);
				for (var i = range.from; i <= range.to; i++)
					if (data[i] === undefined || data[i] == null)
						return false;

				return true;
			}

			function komplett() {
				if (typeof this._komplett === "undefined" || this._komplett === false)
					this._komplett = data.length && isLoaded({from: 0, to: data.length});
				return this._komplett;
			}

			function clear() {
				for (var k in data)
					delete data[k];

				data.length = 0;
			}



			function ensure(range) {
				//from = justerTop(from);
				console.log("ensure.range: ", range);
				range = normaliser(range);
				//to = justerBottom(to);

				console.log("ensure.range.norm: ", range);
				console.log("data: ", data);
				if (isLoaded(range))
				{
					console.log("Range er lastet");

					return this.trigger(events.onDataLoaded, {
						query: query,
						range: range,
						data: data
					});
				}
				var from = range.top || range.from;
				var to = range.bottom || range.to;

				if (req) {
					if (req.abort)
						req.abort();

					for (var i = req.fromPage; i <= req.toPage; i++)
						data[i * PAGESIZE] = undefined;
				}

				if (from < 0) {
					from = 0;
				}

				if (data.length > 0) {
					to = Math.min(to, data.length - 1);
				}

				var fromPage = Math.floor(from / PAGESIZE);
				var toPage = Math.floor(to / PAGESIZE);

				while (data[fromPage * PAGESIZE] !== undefined && fromPage < toPage)
					fromPage++;

				while (data[toPage * PAGESIZE] !== undefined && fromPage < toPage)
					toPage--;

				if (fromPage > toPage || ((fromPage === toPage) && data[fromPage * PAGESIZE] !== undefined)) {
					// TODO:  look-ahead
					return this.trigger(events.onDataLoaded, {
						query: query,
						range: range,
						data: data
					});


				}

				var remoteFra = Math.max(0, (fromPage * PAGESIZE));
				var remoteTil = Math.min(data.length, (((toPage - fromPage) * PAGESIZE) + PAGESIZE));
				key = "?type=" + type + "&q=" + query + "&fra=" + remoteFra + "&til=" + remoteTil + "&filter=" + filter + '&totalt=' + (data.length);
				var requestUrl = (url || '') + key;

				if (sortcol != null)
					requestUrl += "&sortering=" + (sortcol + ((sortdir > 0) ? "+asc" : "+desc"));

				clearTimeout(throttleTimer);

				var handler = onSuccess.bind(this, range);
				//throttleTimer = setTimeout(function() {
				for (var j = fromPage; j <= toPage; j++)
					data[j * PAGESIZE] = null; // null indicates a 'requested but not available yet'

				this.trigger(events.onDataLoading, {
					from: from,
					to: to
				});

				req = $.ajax({
						url: requestUrl,
						cache: true
					})
					.then(handler)
					.fail(onError.bind(null, fromPage, toPage));

				req.fromPage = fromPage;
				req.toPage = toPage;
				return req;
				//}, 50);
			} //, 50);

			function reload(range) {
				range = normaliser(range);
				for (var i = range.from; i <= range.to; i++)
					delete data[i];

				ensure(range);
			}

			function get(range) {
				return Array.prototype.slice.call(data, range.from, range.to - range.from);
			}

			function find(fn) {
				var _fn = !$.isFunction(fn) ? fn : function(p) {
					return p.id === fn;
				};
				for (var i = 0, l = data.length; i < l; i++) {
					if (fn(data[i], i))
						return data[i];
				}
			}

			function insert(range, nytt) {
				var added = 0;

				nytt = !$.isArray(nytt) ? [nytt] : nytt;
				range = typeof range === "number" ? {
					from: range,
					to: range
				} : normaliser(range);
				var teller = 0;
				for (var i = range.from; i < range.to; i++) {

					if (teller >= nytt.length)
						return $.error("IndexOutOfRange");

					if (i > data.length) {
						data[i] = nytt[teller++];
						added.length++;
					} else if (data[i] === undefined || data[i] == null)
						data[i] = nytt[teller++];
				}

				data.length += added;
				if (added)
					this.trigger(events.onTotaltChanged, {
						previous: data.length - added,
						current: data.length
					});
			}

			function add(nytt) {
				var range = {
					from: data.length,
					to: data.length + nytt.length
				};
				insert(range, nytt);
			}

			function setLabel(nytt) {
				label = nytt;
			}

			function setSort(column, dir) {
				sortcol = column;
				sortdir = dir;
				clear();
			}

			function setFilter(nytt) {
				if (filter === String(nytt))
					return;
				filter = String(nytt);
				clear();
			}

			function setSearch(str) {
				str = str || '';
				if ($.trim(query || '') === $.trim(str))
					return;
				if (str.indexOf(query) >= 0) {
					console.log(str + " er subquery til " + query);
				}
				query = str;
				clear();
			}

			init();

			return $.extend(true, {
					// properties
					"key": key,
					"data": data,
					"get": get,
					"add": add,
					"insert": insert,
					"find": find,
					// methods
					"clear": clear,
					"isLoaded": isLoaded,
					"ensure": ensure,
					"reload": reload,
					"setSort": setSort,
					"setSearch": setSearch,
					"setLabel": setLabel,
					"setFilter": setFilter,
					"komplett": komplett,
					// events
					"events": events

				},
				EventEmitter);
		}

		return Source;

	}());


	var Statisk = (function() {

		var noop = function(arg) {
			return arg;
		};

		var defaults = {
			type: 'statisk',
			data: [],
			query: "",
			label: '',
			totalt: 0,
			scorer: noop,
			matcher: noop,
			sorter: noop,
			events: {
				onDataLoading: "onDataLoading",
				onDataLoaded: "onDataLoaded",
				onTotaltChanged: "onTotaltChanged"
			},
			key: ''
		};

		function Statisk(options) {
			var o = $.extend(true, {}, defaults, options || {});
			var query = o.query;
			var data = o.data || [];
			var totalt = o.totalt || data.length;
			var events = o.events;
			var key = o.key;
			var label = o.label;
			var type = o.type;

			function clear() {
				data = [];
			}

			function normaliser(range) {
				if (typeof range === "undefined")
					return {
						from: 0,
						to: data.length
					};
				if (typeof range === "number")
					return {
						from: range,
						to: data.length
					};
				//$.error("Må oppgi parameter til normaliserRange på formen {from|top: 0, to|bottom: 10}");
				if (typeof range.from === "undefined")
					return {
						from: range.top,
						to: range.bottom
					};

				return range;
			}

			function isLoaded(range) {
				return normaliser(range).to <= data.length;
			}

			function ensure(range, callback) {
				range = normaliser(range);

				if (callback && $.isFunction(callback))
					callback(range, Array.prototype.slice.call(data, range.from, range.to - range.from));
				this.trigger(events.onDataLoaded, range);
			}

			function get(range) {

				range = normaliser(range);
				return Array.prototype.slice.call(data, range.from, range.to - range.from);

			}

			function add(items) {
				Array.prototye.push.apply(data, items);
				totalt = data.length;
				this.trigger(events.onTotaltChanged);
			}

			function insert(range, items) {

				var index = typeof range === "number" ? range : range.from;
				items = $.isArray(items) ? items : [items];

				Array.prototype.splice.apply(data, [index, 0].concat(items));
			}

			function find(fn) {
				var _fn = !$.isFunction(fn) ? fn : function(p) {
					return p.id === fn;
				};
				for (var i = 0, l = data.length; i < l; i++) {
					if (fn(data[i], i))
						return data[i];
				}
			}

			function setLabel(q) {
				label = q;
			}

			function setSearch(q) {
				query = q;
			}

			return $.extend(true, {
				"add": add,
				"get": get,
				"insert": insert,
				"find": find,
				"isLoaded": isLoaded,
				"ensure": ensure,
				"totalt": totalt,
				"query": query,
				"label": label,
				"type": type,
				"setLabel": setLabel,
				"setSearch": setSearch
			}, EventEmitter);



		}


		return Statisk;

	}());
	//========================================
	//#region INTERNE VARIABLER OG FUNKSJONER
	//========================================

	var _unik = 0;

	var unikId = function(pattern) {
		_unik++;
		pattern = pattern || '@unikid';
		return pattern.replace(/@unikid/ig, _unik);
	};

	$.extend(window, {
		Tbac: {
			unikId: unikId
		}
	});

	var genererKey = function(params) {

		return '?q=' + params.q + '&type=' + params.type + '&fra=' + params.fra + '&grense=' + params.grense + '&sortering=' + params.sortering + '&filter=' + params.filter;

	};

	var defer = function(fn) {
		setTimeout(fn, 0);
	};

	var obj2url = function(obj, url) {
		var parts = [],
			separator = '?';
		url = url || '';
		for (var k in obj)
			if (obj.hasOwnProperty(k))
				parts.push(k + "=" + obj[k]);
		if (!parts.length)
			return url;
		if (url.indexOf('?') >= 0)
			separator = url[url.length - 1] === "?" ? "" : "&";
		separator = url.indexOf('?') >= 0 ? (url[url.length - 1] === "?" ? "" : "&") : '';
		url += separator + parts.join('&');
	};
	var cache = {};

	var keyCodes = {
		BACKSPACE: 8,
		COMMA: 188,
		DELETE: 46,
		DOWN: 40,
		END: 35,
		ENTER: 13,
		ESCAPE: 27,
		HOME: 36,
		LEFT: 37,
		NUMPAD_ADD: 107,
		NUMPAD_DECIMAL: 110,
		NUMPAD_DIVIDE: 111,
		NUMPAD_ENTER: 108,
		NUMPAD_MULTIPLY: 106,
		NUMPAD_SUBTRACT: 109,
		PAGE_DOWN: 34,
		PAGE_UP: 33,
		PERIOD: 190,
		RIGHT: 39,
		SPACE: 32,
		TAB: 9,
		UP: 38
	};


	$.fn.velgTekst = function(hele) {

		var felles = {
			start: 0,
			slutt: 0,
			hele: ''
		};

		if (typeof hele === "undefined")
			hele = "";

		if (typeof hele === "string")
			felles.hele = hele;

		if (typeof hele === "object" && hele.hasOwnProperty("start") && hele.hasOwnProperty("stopp"))
			$.extend(felles, hele);

		return this.each(function() {

			var konfig = $.extend({}, felles);
			var el = this,
				current = el.value,
				next = konfig.hele || current,
				start = Math.max(next.toLowerCase().indexOf(current.toLowerCase()), 0),
				slutt = Math.max(next.length, current.length);

			el.value = next;

			//slutt = el.value.length;
			if (el.createTextRange) {
				var selRange = el.createTextRange();
				selRange.collapse(true);
				selRange.moveStart('character', start);
				selRange.moveEnd('character', slutt);
				selRange.select();
			} else if (el.setSelectionRange) {
				el.setSelectionRange(start, slutt);
			} else if (el.selectionStart) {
				el.selectionStart = start;
				el.selectionEnd = slutt;
			}
			el.focus();
		});
	};

	var normalizeQuery = function(str) {

		return (str || '').replace(/^\s*/g, '').replace(/\s{2,}/g, ' ');
	};

	var feltFyller22 = function(el, item) {

		el = el instanceof jQuery ? el[0] : el;
		var current = el.value,
			id = String(item.id),
			tekst = item.navn,
			start = current.length,
			slutt;

		el.value = (!id.indexOf(current.toLowerCase())) ? id + ' ' + tekst : tekst;

		slutt = el.value.length;
		if (el.createTextRange) {
			var selRange = el.createTextRange();
			selRange.collapse(true);
			selRange.moveStart('character', start);
			selRange.moveEnd('character', slutt);
			selRange.select();
		} else if (el.setSelectionRange) {
			el.setSelectionRange(start, slutt);
		} else if (el.selectionStart) {
			el.selectionStart = start;
			el.selectionEnd = slutt;
		}
		el.focus();
	};



	//#endregion INTERNE VARIABLER OG FUNKSJONER


	function isMsie() {
		// from https://github.com/ded/bowser/blob/master/bowser.js
		return (/(msie|trident)/i).test(navigator.userAgent) ?
			navigator.userAgent.match(/(msie |rv:)(\d+(.\d+)?)/i)[2] : false;
	}






	//========================================
	//#region TBAC
	//========================================

	//Construct
	var Tbac = function(element, options) {

		var _selected, _verdi, _tekst, _value, o;

		o = this.options = $.extend(true, {}, $.fn.tbac.konfigFraAttr($(element)) || $.fn.tbac.defaults || {}, options);
		this.options.params.type = o.params.type || o.actype;






		this.dataFn = o.dataFn || this.dataFn;
		this.matcher = o.matcher || this.matcher;
		this.sorter = o.sorter || this.sorter;

		if (typeof o.formatter === "string" && this[o.formatter] && $.isFunction(this[o.formatter]))
			this.formatter = this[o.formatter];
		else
			this.formatter = o.formatter || (o.actype === "kan" ? this.idFormatter : this._formatter);

		this.formatSelected = o.formatSelected || (o.multiselect ? this.formatSelected : this.formatter);



		this.liste = null;


		this.filtermal = o.filtermal || '';
		this.filterkilde = o.filterkilde;
		this.prevFilterKildeVerdi = $(this.filterkilde).length ? $(this.filterKilde).data('verdi') : null;

		this.fasteposter = {
			grupper: o.grupper && $.isArray(o.grupper) && o.grupper.length > 2 ? o.grupper : ['Siste', '', 'Felles'],
			topp: o.fasteposter && o.fasteposter.topp && (function(op) {;
			}(o.fasteposter.topp)) || [],
			bunn: (o.fasteposter && o.fasteposter.bunn) && (function(op) {
				var siste = op && $.isArray(op) && op.length ? op.length - 1 : 0;
				return siste ? op.map(function(fp, i) {
					return $.extend({}, fp, {
						cl: 'fastpost' + (i === siste ? ' siste' : '') + (i === 0 ? ' forste' : '')
					});
				}) : [];
			}(o.fasteposter.bunn)) || []
		};



		// Funksjoner
		this.source = new Source({
			type: this.options.params.type,
			filter: this.options.params.filter

		});

		this.topp = new Statisk({
			label: this.fasteposter.grupper[0],
			data: this.fasteposter.topp
		});

		this.bunn = new Statisk({
			label: this.fasteposter.grupper[2],
			items: this.fasteposter.bunn
		});



		this.$btn = $(this.options.templates.button);
		this.$clear = $(this.options.templates.clear);
		this.$menu = $(this.options.templates.menu);
		this.$liste = this.$menu.find('.tbac-liste');

		this.$element = $(element)
			.addClass('tbacinput')
			.addClass('form-control')
			.attr('placeholder', this.options.placeholder || '')
			.attr('autocomplete', 'off')
			.wrap(this.options.templates.wrapper)
			.after(this.$btn)
			.after(this.$clear);

		this.$tbac = this.$element.parents(".tbac").first().append(this.$menu);
		if (this.options.multiselect)
			this.$tbac.addClass("tbac-multiselect");

		//var bw = 32;

		//if (element.style.width)
		//    this.$tbac.css('width', (parseInt(element.style.width.replace(/px|em|rem|pt/ig, ''))+bw)+"px");

		this.query = '';


		// Verdier
		this.selectedItems = {
			length: 0
		};
		this.selectedItem = this.previousItem = null;

		_value = $.trim(this.$element.val());
		_verdi = this.options.verdi || _value;
		_tekst = this.options.tekst || _value;

		if (_verdi) {
			_selected = {
				id: _verdi,
				navn: _tekst
			};
		}

		this.opprinneligItem = $.extend(true, {}, {
			id: "",
			navn: ''
		}, _selected || {}, this.options.selecteditem || {});

		if (!this.opprinneligItem || !this.opprinneligItem.id)
			this.opprinneligItem = null;

		if (_selected) {
			if (_selected.navn && _selected.navn !== "undefined")
				this._select(_selected);
			else {
				_selected.navn = 'Henter..';
				this.$element.val(this.formatSelected(_selected));
				this.info(_selected).then(this._select.bind(this));
			}
		}





		this.shown = false;
		this.req = null;
		this.timeout = null;



		this.listen();




	}; //Contruct

	//Prototype
	Tbac.prototype = {
		constructor: Tbac,

		_count: function() {
			return this.source.data.length + this.fasteposter.topp.length + this.fasteposter.bunn.length;
		},
		_erAktiv: function() {
			var active, isActive, hasActive;

			active = document.activeElement;
			isActive = this.$tbac.is(active);
			hasActive = this.$tbac.has(active).length > 0;

			return isActive || hasActive;
		},
		//#region Private

		_trigger: function(navn, data, callback) {
			var event = $.Event(navn, {
				tbac: this,
				tbacdata: data
			});
			this.$element.trigger(event, data);
			return (callback ? callback.call(this, event.result, this) : event.result);
		},


		_reload: function() {
			this.source.reload();
		},
		_selectedValues: function() {
			var vals = [],
				s = this.selectedItems;
			for (var i in s)
				if (s.hasOwnProperty(i) && i !== "length")
					vals.push(s[i].id);
			return vals;
		},
		_filterkildeEndret: function(e, item) {
			if ((!item && this.prevFilterKildeVerdi) || item !== this.prevFilterKildeVerdi) {
				this.clear();
			}
		},
		_liste: function() {
			if (this.liste)
				return this.liste;


			var self = this;
			var c = {

				rowHeight: this.options.rowHeight,
				getItems: function(r) {
					return self.source.ensure(r);
				},
				itemRenderer: function() {
					var rx = self.query ? new RegExp('(' + self.query + ')', 'ig') : null;

					return function(item, index, query) {
						var rx = query ? new RegExp('(' + query + ')', 'ig') : null;
						return $.tmpl("tbacitem", item, {
							hl: function(t) {
								return !rx ? t : $.trim(String(t).replace(rx, function($1, match) {
									return '<strong>' + match + '</strong>';
								}) || '') || t;
							},
							index: index
						}).data("item", item);
					};
				},
				sources: [this.topp, this.source, this.bunn]


			};

			this.liste = this.$liste.tbliste(c).data('tbliste');
			this.settViewportHeight();
			return this.liste;
		},

		_verdi: function(verdi) {
			if (typeof verdi === "undefined")
				return $.trim(this.$element.val());

			if (typeof verdi === "string" && !verdi.length) {
				this.reset(null, true);
				return this;
			}

			this.info(verdi).then(this.select.bind(this));
			return this;
		},
		finn: function(item) {
			var verdi = typeof item === "object" && item.hasOwnProperty("id") ? item.id : item;
			verdi = String(verdi).toLowerCase();
			return this.source.find(verdi);
		},
		info: function(item) {
			var verdi = typeof item === "object" && item.hasOwnProperty("id") ? item.id : item;
			var source = this.source;

			var funnet = this.finn(verdi);

			if (funnet)
				return $.Deferred().resolveWith(funnet);

			if (this.infoReq) {
				if (this.infoReq.id && this.infoReq.id == verdi)
					return this.infoReq;
				if (this.infoReq.abort)
					this.infoReq.abort();
			}

			var payload = {
				funk: 'info',
				type: this.options.params.type,
				filter: verdi,
				ekstra: this.options.params.filter //this.filterFn()
			};
			//this.infoReq = $.getJSON(obj2url(payload, 'tbac_bs.asp')).then(function(svar) { data.poster.push(svar); return svar; }).done(this.select.bind(this));
			this.infoReq = $.getJSON('tbac_bs.asp', payload).then(function(svar) {
				source.add(0, svar);
				return svar;
			});
			this.infoReq.id = verdi;

			return this.infoReq;
		},


		settStatus: function() {
			if (this._verdi() || this.selectedItem || this.options.multiselect && this.selectedItems.length) {
				this.$tbac.addClass('harVerdi');
			} else {
				this.$tbac.removeClass('harVerdi');
			}
		},

		settBunntekst: function(tekst) {
			if (typeof tekst === "undefined")
				return this.$tbac.find('.tbac-bunn-tekst').html();
			this.$tbac.find('.tbac-bunn-tekst').html(tekst);
		},

		settFiltermal: function(verdi) {
			if (typeof verdi === "undefined")
				return this.filtermal;
			this.filtermal = verdi;
			return this;
		},

		settFilterkilde: function(arg) {
			var $el = $(arg);
			$(this.filterkilde).off("endret", this._filterKildeEndret.bind(this));
			this.filterkilde = $el;
			this.clear();
			$(this.filterkilde).on('endret', this._filterKildeEndret.bind(this));
		},

		settRange: function(range) {
			if (typeof range === "object") {
				if (range.hasOwnProperty("fra"))
					this.options.params.fra = parseInt(range.fra || '0', 10);
				if (range.hasOwnProperty("grense"))
					this.options.params.grense = parseInt(range.grense || '0', 10);
				if (range.hasOwnProperty("til"))
					this.options.params.til = parseInt(range.til || '0', 10);
			}

		},

		settSortering: function(verdi) {
			if (verdi === this.options.params.sortering)
				return;

			this.clear();
			this.options.params.sortering = ($.isFunction(verdi) ? verdi(this) : verdi);
		},

		settFilter: function(verdi) {
			var self = this;
			if (verdi)
				this.options.params.filter = verdi;
			else
				this.options.params.filter = '';
			this.filterFn = function(parametre) {
				var params = $.extend(true, {}, self.options.params, {
					q: self.query
				}, parametre || {}, {
					filter: verdi
				});

				return params;
			};
		},

		settFaste: function(f) {

			var mapper = function(fp, i, arr) {
				fp.cl = (fp.cl || '') + ' fastpost' + (i === arr.length - 1 ? ' siste' : '') + (i === 0 ? ' forste' : '');
				return fp;
			};


			this.topp.clear();
			this.bunn.clear();

			if (f.grupper.length)
				this.topp.setLabel(f.grupper[0]);

			if (f.topp.length)
				this.topp.add(f.topp.map(mapper));


			if (f.grupper[1].length > 0)
				this.source.setLabel(f.grupper[1]);

			if (f.grupper.length > 1)
				this.bunn.setLabel(f.grupper[2]);

			if (f.bunn.length)
				this.bunn.add(f.bunn.map(mapper));


			if (this.liste)
				this.liste.clear();
			if (this.shown)
				this.process();

		},
		//#endregion Private
		_genererFilter: function() {
			var t = this,
				verdi, fk, fm, $f, filter;
			filter = this.options.filter;
			if (t.filterkilde && t.filtermal && typeof t.filterkilde !== "string") {
				verdi = t.data('verdi');
				filter = t.filtermal.replace(/\?[[a-z]{3}/ig, verdi);
			} else if (t.filterkilde && t.filtermal) {
				fk = t.filterkilde.split(',');
				fm = t.filtermal.split(',');
				filter = [];
				fk.forEach(function(f, i) {
					$f = $(f);
					verdi = $f.data("verdi");
					if (verdi)
						filter.push(fm[i].replace(/\?[[a-z]{3}/ig, verdi));
				});
				filter = filter.join(' AND ');
			}

			return filter || '';
		},
		//#endregion



		/*******************************

            SELECT

            *******************************/
		//#region Select

		_select: function(item) {

			if (!item)
				return false;

			if (this.selectedItem && this.selectedItem.id == item.id)
				return false;

			var test = this._trigger("endres", item);
			if (test === false)
				return false;


			this.previousItem = this.selectedItem;
			this.selectedItem = null;
			if (this.options.multiselect) {
				if (this.selectedItems[item.id]) {
					delete this.selectedItems[item.id];
					this.selectedItems.length--;
					for (var k in this.selectedItems)
						if (this.selectedItems.hasOwnProperty(k) && k !== "length")
							this.selectedItem = this.selectedItems[k];
				} else {
					this.selectedItems[item.id] = item;
					this.selectedItems.length++;
					this.selectedItem = item;
				}

				this.$element.attr('placeholder', this.formatSelected(this.selectedItems));
			} else {
				this.selectedItem = item;
				this.$element.val(this.formatSelected(item));
			}




			return true;
		},

		select: function(item) {


			if (!this._select(item))
				return;

			// console.log("Trigger ikke endret da dette er oppstartsverdivalg");
			if (!(this.previousItem && this.selectedItem && this.selectedItem.id === this.previousItem.id))
				this.$element.trigger("endret", item);



			if (this.options.multiselect)
				this.$element.val('');
			else
				this.hide();

		},

		//#endregion Select


		/*******************************

            SELECT

            *******************************/
		//#region Søk
		sok: function(query) {

			if (!query || typeof query !== "string")
				query = '';

			if (query && this.query && query === this.query)
				return this;

			if (query.length && query.length < this.options.minBokstaver)
				return this;

			this.query = query;
			this.source.setSearch(query);

			clearTimeout(this.timeout);
			//this.timeout = setTimeout(this.source.ensure.bind(this.source, { from: 0, to: 100 }), this.options.delay);
			this.timeout = setTimeout(this.dataFn.bind(this, {from: 0, to: 100}), this.options.delay);



		},

		dataFn: function(params) {


			//console.log(this.filterFn);

			this.params = $.extend(true, {}, this.options.params, {
				filter: this._genererFilter()
			}, {
				q: this.query
			}, params);


			if (this._trigger("førsøk", this.params) === false)
				return null;

			this.source.setFilter(this.params.filter);
			this.source.setSearch(this.params.query);
			this.source.ensure({
				from: this.params.fra,
				to: this.params.til || this.params.grense || 100
			});

		},
		//#endregion Søk




		/*******************************

            ETTERBEHANDLING/FILTRERING

            *******************************/
		//#region Etterbehandling
		_process: function(items, query) {



			if (this.matcher)
				items = this.matcher(items, query);

			if (this.scorer)
				items = this.scorer(items, query);

			if (this.sorter)
				items = this.sorter(items, query);

			return items;

		},
		process: function() {

			var source, items, topp, bunn, totalt, query;

			source = this.source.data;
			topp = this.topp.data;
			bunn = this.bunn.data;
			totalt = this.source.totalt + this.topp.totalt + bunn.totalt;
			query = this.source.query || '';

			if (this.topp.label)
				topp.unshift();
			if (this.bunn.label)
				bunn.unshift()
			items = [{
				id: 'g',
				navn: this.topp.label
			}].concat(this._process(topp, query)).concat([{
				id: 'g',
				navn: this.source.label
			}]).concat(this._process(items, query)).concat([{
				id: 'g',
				navn: this.bunn.label
			}]).concat(this._process(bunn, query));


			this.trigger("onDataBehandlet", {
				query: query,
				totalt: totalt,
				data: items
			});

		},
		_formatter: function(item) {
			return item ? (item.id + ' ' + (item.navn || '')) : '';
		},
		idFormatter: function(item) {
			return item && item.id || '';
		},
		formatSelected: function(data) {
			if (typeof data === "undefined")
				return 'Ingen valgt';
			if (!this.options.multiselect)
				return this.formatter(data);
			if ($.isPlainObject(data)) {
				if (data.hasOwnProperty("id")) {
					return this.formatter(data);
				} else {
					var items = [];
					for (var s in data)
						if (s !== "length" && data.hasOwnProperty(s) && typeof data[s] !== "undefined")
							items.push(this.formatter(data[s]));
					return items.length > 3 ? items.length + ' valgt' : items.splice(0, 3).join(', ');
				}
			}

			return this.formatter(data);

		},

		scorer: function(items, query) {
			return $.map(items, function(item) {
				item.poeng = ((item.id + item.navn).toLowerCase().indexOf(query.toLowerCase()));
				return item;
			});
		},
		matcher: function(items, query) {
			return $.grep(items, function(item) {
				if (!item.id || !query || ~(item.id + ' ' + item.navn).toLowerCase().indexOf(query.toLowerCase()))
					return item;
			});
		},
		sorter: function(items, query) {
			return (!query || !items) ? items : items.sort(function(a, b) {
				return a.poeng - b.poeng;
			});
		},

		/*
            scorer: null,
            matcher: null,
            sorter: null,
            */
		//#endregion Behandling







		/*******************************

            RENDER

            *******************************/
		//#region Render

		render: function(items, totalt, query, rr) {
			this.items = items;
			totalt = totalt && !isNaN(totalt) && totalt || 0;

			if (!this.shown)
				this.show();

			this.liste.clear();
			this.liste.items = items;
			this.liste.totalt = totalt;
			var range = this.liste.getRenderedRange();
			this.liste.renderRows(range, items);

			if (this.options.selectFirst && items.length === 1)
				this._select(items[0]);

			else if (this.options.autofyll && items.length > 0) {
				console.log("AUTOFYLL")
				var item = items[0];
				if (query && (!String(item.id).toLowerCase().indexOf(query.toLowerCase()) || !item.navn.toLowerCase().indexOf(query.toLowerCase()))) {
					var current = this._verdi();
					this.select(item);
					this.$element.val(current);
					this.$element.velgTekst(!this._verdi().indexOf(item.id) ? this.formatter(item) : item.navn);
					this._trigger("autovalg", item);

				}
			}
			if (this.options.multiselect)
				this.settBunntekst(this.selectedItems.length + " av " + totalt + " poster valgt");
			else
				this.settBunntekst(totalt + " poster funnet.");

			return this;
		},

		//#endregion Render



		/*******************************

            EVENTS

            *******************************/
		//#region Events

		//#region Bind
		listen: function() {

			var $input = this.$element,
				$menu = this.$menu;



			// prevents input blur due to clicks within dropdown menu
			$menu.on('mousedown.tbac', function($e) {
				$e.preventDefault();
			});
			$input
			//.on('blur', this.blur.bind(this))
			.on('keydown', this.keypress.bind(this))
				.on('keyup', this.keyup.bind(this))
				.on('focus', this.focus.bind(this))
				.on('sok', this.sok.bind(this))
				.on('last', this._reload.bind(this))
				.on('show', this.show.bind(this))
				.on('hide', this.hide.bind(this))
				.on('velg', this.select.bind(this))
				.on('blur.tbac', function($e) {

					var active, isActive, hasActive;

					active = document.activeElement;
					isActive = $menu.is(active);
					hasActive = $menu.has(active).length > 0;

					if (isMsie() && (isActive || hasActive)) {
						$e.preventDefault();
						// stop immediate in order to prevent Input#_onBlur from getting exectued
						$e.stopImmediatePropagation();
						defer(function() {
							$input.focus();
						});
					}
				})
				.on('getData', this.onSetData.bind(this))
				.on('setData', this.onGetData.bind(this))
				.on('reset', this.reset.bind(this))
				.on('endret', this.onEndret.bind(this))
				.on('oppdatert', this.onOppdatert.bind(this));

			//this.$liste.on("mouseenter", clearTimeout.bind(window, this.closeTimeout));

			this.$tbac
				.on("click", ".tbac-liste .tbac-item", this.klikkItem.bind(this));
			this.$btn
				.on('click', this.klikkBtn.bind(this));

			var self = this;
			this.source.onSync("onTotaltChanged", function(e, data) {
				self.liste.totalt = data.current;
				if (data.current !== data.previous)
					self.liste.resizeCanvas();
			});
			this.source.onAsync("onDataLoaded", function(e, data) {

				self.render(data.data, data.data.length, this.query, data)
				//self.liste.render();
			});
		},

		//#endregion

		onEndret: function(e, item) {
			//console.log("Tbac.endret: ", item);
			this.settStatus();
		},
		onBehandlet: function(e, items) {
			var h = Math.min(this.options.antallItems, this.getTotalt(items));
			this.settViewportHeight(h);
		},
		onOppdatert: function(e, data) {
			this.settViewportHeight();
		},

		onSetData: function(e, key) {
			//console.log("onSetData.args: ", arguments); console.log("this: ", this);
			switch (key) {
				case "verdi":
					if (!this.selectedItem)
						return this.options.actype === "kan" ? this._verdi() : '';
					if (this.options.multiselect)
						return this._selectedValues();
					return this.options.actype === "kan" ? this._verdi() : this.selectedItem.id;

				case "selectedItem":
					if (!this.selectedItem || (this.options.multiselect && !this.selectedItems.length))
						return '';
					return this.options.multiselect ? this.selectedItems : this.selectedItem;

				case "filter":
					return this._genererFilter();

				case "sortering":
					return this.source.sortering;


			}

		},
		onGetData: function(e, key, verdi) {
			//console.log("onGetData.args: ", arguments); console.log("verdi: ", verdi);
			if (key === "verdi") {
				throw new Error("Ikke lov å sette verdien på denne måten. Bruk $(el).trigger('velg', verdi)");
			}
			switch (key) {
				case "verdi":
					this._verdi(verdi);
					break;

				case "selectedItem":
					this.select(verdi);
					break;

				case "filter":
					this.settFilter(verdi);
					break;

				case "sortering":
					this.settSortering(verdi);
					break;

				case "fra":
					this.settRange(typeof verdi === "number" ? {
						fra: verdi
					} : verdi);
					break;

				case "fra":
					this.settRange(typeof verdi === "number" ? {
						til: verdi
					} : verdi);
					break;

				case "grense":
					this.settRange(typeof verdi === "number" ? {
						grense: verdi
					} : verdi);
					break;

				case "fasteposter":
					this.settFaste(verdi);
					break;

			}

			return this.$element;
		},

		klikk: function(e) {
			e.stopPropagation();
			e.preventDefault();
			e.stopImmediatePropagation();
			console.log("klikk kverket! Five!!. This: ", this, ". Jhee: ", e);
		},
		klikkBtn: function(e) {

			e.preventDefault();
			e.stopImmediatePropagation();
			if (this.$element.is(':disabled'))
				return false;

			if (!this.liste)
				this._liste();

			if (this.shown)
				return this.hide();
			else if (!this.source.komplett())
				this.sok('');
			else
				this.process();
		},

		klikkItem: function(e) {
			e.preventDefault();
			var target = $(e.target).closest('.tbac-item');
			if (!target.length) {
				console.log("Ikke tbac-item");
				return false;
			}
			if (target.hasClass('gruppe')) {
				//console.log("Gruppe");
				return false;
			}
			if (target.hasClass('ingentreff')) {
				//console.log("Dummt");
				return false;
			}
			e.stopPropagation();

			var item = target.toggleClass("selected").data("item");

			this.select(item);
		},

		keyup: function(e) {

			var key = keyCodes;
			switch (e.keyCode) {
				case key.DOWN:
				case key.UP:
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();


					if (!this.shown && this._count()) {
						this.show();
					} else if (!this.shown) {
						this.sok(this._verdi());
					}


					break;
				case key.TAB:
				case key.ENTER:
					e.preventDefault();
					e.stopPropagation();
					if (!this.shown)
						if (!this.selectedItem)
							if (this._count())
								this.select(this.source.data[0]);
							else {
								var el = this.$liste.find('.active');
								if (el.filter('.tactive').length)
									el = el.filter(".tactive");
								if (el && el.length && el.data("item"))
									this.select(el.data("item"));
							}
					if (!this.options.multiselect) this.$element.blur();
					break;
				case key.ESCAPE:
					e.preventDefault();
					//console.log("Escape..");
					if (this.opprinneligItem)
						this.select(this.opprinneligItem);

					break;
				default:
					e.stopPropagation();
					e.preventDefault();
					//console.log("søker i keyup > default: ", e);
					this.settStatus();
					this.sok(this._verdi());
					break;
			}

		},

		keypress: function(e) {
			//e.stopPropagation();
			//console.log("keypress: ", e);
			var velges;
			if (!this.shown) {
				//console.log("Usynlig");
				return;
			}

			switch (e.keyCode) {
				case keyCodes.ESCAPE:
					e.preventDefault();
					velges = this.opprinneligItem;
					if (!velges)
						this._verdi('');
					else
						this.select(velges);

					defer(this.hide.bind(this));
					break;

				case keyCodes.TAB:
				case keyCodes.ENTER:
					e.preventDefault();
					e.stopPropagation();
					e.stopImmediatePropagation();




					if (!this.shown)
						velges = this.selectedItem;
					else {
						var el = this.$tbac.find('.active');
						if (el.filter('.tactive').length)
							el = el.filter(".tactive");
						if (el && el.length && el.data("item"))
							velges = el.data("item");
					}

					this.select(velges);
					if (!this.options.multiselect) this.$element.blur();
					break;
				case keyCodes.UP:
					e.preventDefault();
					e.stopPropagation();
					this._liste().$element.trigger("forrige");
					break;
				case keyCodes.DOWN:
					e.preventDefault();
					e.stopPropagation();
					this._liste().$element.trigger("neste");
					break;
			}
		},
		settViewportHeight: function(h) {
			h = h || (Math.min(this.options.antallItems, 12) || this.options.antallItems);
			this.liste && this.liste.$viewport && this.liste.$viewport.css("height", (h * this.options.rowHeight) + 'px');
		},
		blur: function(e) {
			e.stopPropagation();
			e.preventDefault();
			if (!this.selectedItem)
				return;
			//this.$element.val('')
			if (this.$element.val() !== this.formatter(this.selectedItem))
				this.$element.val(this.formatter(this.selectedItem));
			//clearTimeout(this.closetimeout);
			//this.closetimeout = setTimeout(this.select.bind(this, this.selectedItem), 500);
		},

		focus: function(e) {
			//e.stopImmediatePropagation();
			e.preventDefault();
			if (!this.shown && this._count())
				this.show();
			var tekst = this._verdi();
			if (tekst)
				this.$element.velgTekst(tekst);
			//console.log("focus: ", e);
			//$(e.target).velgTekst();
			//setTimeout(feltFyller.bind(null, e.target, $(e.target).val()), 50);
		},
		feltFyller: function(el, item) {

			var current = el.value,
				id = String(item.id),
				tekst = item.navn,
				start = current.length,
				slutt;

			el.value = (!id.indexOf(current.toLowerCase())) ? id + ' ' + tekst : tekst;

			slutt = el.value.length;
			if (el.createTextRange) {
				var selRange = el.createTextRange();
				selRange.collapse(true);
				selRange.moveStart('character', start);
				selRange.moveEnd('character', slutt);
				selRange.select();
			} else if (el.setSelectionRange) {
				el.setSelectionRange(start, slutt);
			} else if (el.selectionStart) {
				el.selectionStart = start;
				el.selectionEnd = slutt;
			}
			el.focus();
		},
		//#endregion Handlers


		//#endregion Events





		/*******************************

            STATE

            *******************************/
		//#region State

		_clearSelection: function(undo) {
			if (typeof undo !== "boolean") {
				var args = Array.prototype.slice.call(arguments, 0);
				undo = args.length > 1 && args[1] === true;
			}

			var prev = this.previousItem;
			this.previousItem = this.selectedItem;
			this.selectedItem = null;
			for (var i in this.selectedItems)
				if (this.selectedItems.hasOwnProperty(i))
					delete this.selectedItems[i];
			this.selectedItems.length = 0;
			this.liste && this.liste.clear();
			this.$menu.find('.selected').removeClass('selected');
			if (undo)
				this.select(prev);
			else
				this.$element
				.val('')
				.attr('placeholder', this.options.placeholder);
		},
		_clearData: function() {
			this.data.poster = [];
			this.data.totalt = 0;
			this.items = [];
			this.$liste.trigger("clear");
		},
		reset: function() {

			this._clearSelection();

		},
		clear: function() {

			this
				._clearData()
				._clearSelection(false)
				.hide()
				.$element
				.trigger("endret", null);

			return this;
		},

		show: function() {
			if (!this._erAktiv()) {
				console.log("Åner ikke boksen da den ikke har fokus");
				return this;
			}
			var o = this.$element.offset().top,
				h = this.$menu.height() || 300,
				b = $(window).height() + $(window).scrollTop();

			if ((o + h) > b)
				this.$tbac.addClass('opp');
			else
				this.$tbac.removeClass('opp');

			var $el = this.$element;
			defer(function() {
				$('.tbac.open .tbacinput').not($el).trigger('hide');
			});

			this.$tbac.addClass('open').find('.tbac-toggle-dropdown i').addClass('icon-rotate-180');
			this.shown = true;
			return this;
		},
		hide: function() {
			this.$tbac.removeClass('open').find('.tbac-toggle-dropdown i').removeClass('icon-rotate-180');
			this.shown = false;
			return this;
		}

		//#endregion Base


	}; // Prototype

	$.extend(Tbac.prototype, EventEmitter);


	//#endregion TBAC







	//==============================
	/*******************************

    PLUGIN

    *******************************/
	//========================================

	//#region Plugin

	//#region Definiton
	$.fn.tbac = function(option) {


		var args = Array.prototype.slice.apply(arguments, [1]);

		return this.each(function() {

			var $this = $(this),
				data = $this.data('tbac'),
				filterkilde = $(this.getAttribute('data-filterkilde') || null),
				filtermal = this.getAttribute("data-filtermal"),
				options = typeof option === 'object' && option;



			if (!data) {
				$this.data("tbac", (data = new Tbac(this, options)));
				if ($this.hasClass('data-tbac-map'))
					$this.on("endret", attributtMapper);
				if (filterkilde.length)
					filterkilde.on('endret', function(e, item) {

						if ($this.data('verdi') == item.id) {
							console.log("Samme item (", item, "), clearer ikke");
						} else {
							$this.trigger("clear");
						}
					});
			} else if (typeof option === 'string') {
				$this.data("resultat", null);
				var met = data[option],
					resultat;


				if (typeof met === "function")
					resultat = met.apply(data, args);
				else
					resultat = met;

				$this.data("resultat", resultat);

			} else if (typeof option === "function") {

				resultat = option.apply(data, args);
				$this.data("resultat", resultat);


			}

			return this;

		});
	};

	$.fn.tbac.Constructor = Tbac;
	//#endregion Definition

	//#region Defaults
	$.fn.tbac.defaults = {
		url: 'tbac_bs.asp' // adresse til søkekoden
		,
		actype: '',
		params: { // parametre som sendes til server ved søk
			q: '' // søketeksten
			,
			type: '' // typen boks (data-actype)
			,
			fra: 0 // hopp over de først x resultatene
			,
			grense: 20 // TOP x
			,
			sortering: '' // ORDER BY x
			,
			filter: '' // WHERE x
		}

		,
		filtermal: '' // streng der verdien i filterkilde elementet flettes inn
		,
		filterkilde: null // id|class|selector til ett element med .val() metode eller verdi i data('verdi')
		// data-filtermal="OppgaveNr='?pro' --> data-filter="OppgaveNr='1000'" for eksempel.

		,
		statisk: false // ingen serversøk
		,
		items: null // array eller funksjon som kan bruker som datakilde ved statisk=true
		,
		selectedItem: null // startverdien i form av ett item-objekt ({ id: '1000', navn: 'Testprosjekt'})
		,
		fasteposter: { // faste 'items' over og under resultatene
			grupper: ["Topp", "Resultater", "Andre"],
			topp: [],
			bunn: []
		},
		required: false // om det skal være mulig å tømme boksen
		,
		disableTom: true // om inputen skal disables om det ikke får treff fra server
		,
		virtual: true // virtuell rendering av lange lister
		,
		rowHeight: 26 // radhøyde i dropdown
		,
		antallItems: 8 // maks antall items som vises i dropdown
		,
		minBokstaver: 1 // minimum antall bokstaver en må skrive for å trigge søk
		,
		delay: 150 // forsinkelse etter tastetrykk før søk starter (om en ikke er ferdig)
		,
		bredde: '100%' // ønsket bredde på dropdown.

		,
		multiselect: false // select="multiple" erstatning
		,
		autofyll: false // automatisk fyll ut boksen med først treff og select den tillagte delen
		,
		selectFirst: false // automatisk valg av første treff om det bare er 1 treff
		,
		placeholder: '' // brukes til å vise antallet valgt ved multiselect

		// diverse hooks for å behandle resultatdataene etter søk men før render
		// eller for å søke i statiske data
		,
		matcher: null // function(item, query) { if (blabla) return item; }
		,
		formatter: null // function(item) { return (!item ? '' : (item.id+' '+item.navn)); }
		,
		scorer: null // function(items, query) { return items; }
		,
		sorter: null // function(items, query) { return items; }


		,
		templates: {
			wrapper: '<div class="tbaheadwrapper tbac"><div class="input-group tbac-inner"></div></div>',
			clear: '<span class="input-group-addon tbac-toggle tbac-clear" tabindex="-1"><i class="icon-remove"></i></span>',
			konfig: '<span class="input-group-addon tbac-toggle tbac-konfig" tabindex="-1"><i class="icon-cog"></i></span>',
			button: '<span class="input-group-addon tbac-toggle tbac-toggle-dropdown" tabindex="-1"><i class="icon-caret-down"></i></span>',
			item: '<li class="tbac-item ${cl}" title="${navn}"><span class="id">{{html $item.hl(id)}}</span> <span>{{html $item.hl(navn)}}</span></li>',
			menu: '<div class="tbac-dropdown clearfix"><div class="tbac-topp"><a href="#" class="tbac-item tbac-velgingen">Ingen</a></div><div class="tbac-liste"></div><div class="tbac-bunn"><p class="tbac-bunn-tekst"></p></div></div>'
			//<button class="btn btn-default tbac-velgingen btn-block btn-sm">Ingen</button>

		}

	};

	$.fn.tbac.konfigFraAttr = function($element) {

		var attr, base;

		attr = $element.data();
		base = $.extend(true, {}, $.fn.tbac.defaults, attr);

		base.params.type = attr.actype;
		base.params.filter = attr.filter || '';
		base.params.grense = attr.grense || 0;
		base.params.sortering = attr.sortering;


		if (attr.fasteposter && typeof attr.fasteposter === "string") // && !(attr.fastepostertopp || attr.fasteposterbunn))
		{
			base.fasteposter = {
				topp: [],
				bunn: []
			};
			//var arr = JSON.parse('{"test":'+("[['','- Ingen -']]".replace(/'/ig, '\"'))+'}');

			var arr = JSON.parse('{"wrap":' + (attr.fasteposter.replace(/'/ig, '\"')) + '}');
			if (arr && arr.wrap && $.isArray(arr.wrap) && arr.wrap.length && $.isArray(arr.wrap[0])) {
				base.fasteposter.topp = arr.wrap.map(function(ai) {
					return {
						id: ai[0],
						navn: ai[1]
					};
				});
			}
		}

		if (typeof base.fasteposter === "undefined" || typeof base.fasteposter !== "object")
			base.fasteposter = {
				grupper: [],
				topp: [],
				bunn: []
			};
		if (!base.fasteposter.grupper)
			base.fasteposter.grupper = ['', '', ''];
		if (!base.fasteposter.grupper.length && attr.grupper)
			if ($.isArray(attr.grupper))
				base.fasteposter.grupper = attr.grupper;
			else {
				var gp = (attr.grupper + '').split(',');
				if (gp.length < 3) {
					for (var i = gp.length; i < 3; i++)
						gp[i] = "Gruppe " + i;
				} else if (gp.length > 3) {
					gp = gp.slice(0, 2);
				}
				base.fasteposter.grupper = gp;


			}


		if (!base.fasteposter.topp.length)
			base.fasteposter.topp = $.isArray(attr.fastepostertopp) && attr.fastepostertopp || ($.isArray(attr.fasteposter) && attr.fasteposter || []);

		if (!base.fasteposter.bunn.lenth)
			base.fasteposter.bunn = $.isArray(attr.fasteposterbunn) && attr.fasteposterbunn || [];

		//base.selectedItem = base.startItem || attr.verdi&&attr.tekst ? { id: attr.verdi, navn: attr.tekst } : null;

		return base;




	};


	$.fn.tbcombo = $.fn.tbac; // Bakovercompatibel



	/*******************************

    AKTIVERING

    *******************************/
	//#region Aktivering


	$(document).ready(function() {

		$.template("tbacitem", $.fn.tbac.defaults.templates.item);


		$('input.tbacinput').addClass('frase').not('.manuell').not('.tbac-aktivert').each(function() {
			var $this = $(this).addClass('tbac-aktivert');
			if (!$.hasData(this) && !$this.data('tbac')) {
				$this.tbac();
			}
		});


		$(document)
			.on('mousedown', function(e) {
				var self = $(this),
					t = $(e.target);

				var aktiv = $(document.activeElement).parents('.tbac.open:first');

				$('.tbac.open').each(function() {
					if (aktiv.length && aktiv[0] == this) {
						//console.log("Lukker IKKE: ", this, " er en del av aktivt element: ", document.activeElement);
					} else {
						//console.log("Lukker: ", this);
						$(this).find('.tbacinput').trigger('hide');
					}
				});
			})
			.on('click', '.tbac-clear', function(e) {
				e.preventDefault();

				$(this).parents('.tbac:first').find('.tbacinput').trigger('reset');

			})
			.on('click', '.tbac-velgingen', function(e) {
				e.preventDefault();

				$(this).parents('.tbac:first').find('.tbacinput').trigger('reset', false);

			})
			.on('submit', "form", function() {
				var kol, verdi;
				$(this).find('.tbacinput').each(function() {

					kol = this.getAttribute("data-tbac-verdifelt") || 'verdi';
					$(this).val($(this).data(kol) || '');
				});


			});
		/*
            .on('keyup', function(e) {
                console.log("keypress.e ", e, " active: ", document.activeElement);
                if (!document.activeElement)
                    return;
                var opp = 38, ned = 40;
                var $tbac = $('.tbac.open:first');
                if ($tbac.length && (e.keyCode === opp || e.keyCode === ned))
                {
                    e.stopImmediatePropagation();
                    //e.stopPropagation();
                    e.preventDefault();
                    $tbac.find('.tbac-liste').trigger(e.keyCode === 38 ? "neste" : "forrige");

                }

            });*/




	});
	//#endregion



	//#region Util


	function attributtMapper(e, item) {

		var $parent = $(this).parents('[data-tbac-map="parent"]').first(),
			type = $(this).data('tbac').options.params.type,
			url = 'tbac_bs.asp?funk=merinfo&type=' + type;

		$.getJSON(url, item).done(attributtFyller.bind($parent));
	}

	function attributtFyller(info) {

		var $el, $tr = this;
		if (info)
			for (var k in info)
				if (info.hasOwnProperty(k) && (($el = this.find('[data-tbac-map="' + k + '"]')).length))
					$el.addClass('endret').html(info[k] || '').val(info[k] || '');

		this.find('[data-tbac-map="focus"]').addClass('endret').focus();
		setTimeout(function() {
			$tr.find('.endret').removeClass('endret');
		}, 1000);
	}

	function _plasserInfoOld(vareinfo) {
		var $tr = this;
		$tr
			.find("input.VlinjeNavn").addClass('endret').val(vareinfo.navn).end()
			.find("input.VlinjePris").addClass('endret').val(vareinfo.salgspris).end()
			.find("input.VlinjeKostPris").addClass('endret').val(vareinfo.kostpris).end()
			.find("input.VEnhet").addClass('endret').val(vareinfo.enhet).end()
			.find('input.VAntall').addClass('endret').focus();
		setTimeout(function() {
			$tr.find('.endret').removeClass('endret');
		}, 1000);
	}
	//#endregion Util


	/*
                    if (self.options.actype === "kan")
                        return function(item, index, query) {
                            var rx = query ? new RegExp('(' + query + ')', 'ig') : null;
                            return $.tmpl("tbacitem", { id: item.id, navn: '' }, {
                                hl: function(t) {
                                    return !rx ? t : $.trim(String(t).replace(rx, function($1, match) {
                                        return '<strong>' + match + '</strong>';
                                    }) || '') || t;
                                },
                                index: index
                            }).data("item", item);
                        };

*/


})(window.jQuery);