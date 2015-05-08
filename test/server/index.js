/* globals Session, Response, Request, Application, Server */
	
	var Util, Oppslag, Db, Server;
	var http, url, win32ole;
	
	url = require('url');
	http = require('http');
	win32ole = require('win32ole');
	
	Server = http.createServer(requestHandler);
	Server.listen(8080);
	
	function requestHandler(req, res) {
		var db, resultat, params, qs, requrl;
		
		console.log("qe paaassssaaa???");
		if (false) {
			resultat = "test";
		}
		else {
			db = new Db('tresamkontor_erlend.mdb');
			requrl = url.parse(req.url, true);
			qs = function(key, alt) {
				var value = requrl[key]+'';
				return value && value !== "undefined" && value !== "null" ? value : '';
			};
			
			params = {
				query: qs("q") || qs("query") || '',
				totalt: Util.toInt (qs("totalt")),
				fra: Util.toInt(qs("fra")),
				til: Util.toInt(qs("til") || qs("grense") || qs("maks")) || 100,
				type: qs("type"),
				funk: qs("funk"),
				sortering: decodeURIComponent (qs("sortering")),
				filter: decodeURIComponent (qs("filter")),
				felt: (qs("felt") + '').split(','),
				id: qs("id"),
				ekstra: qs("ekstra")
			
			}


		
			if (!params.type) {
				resultat = "Mangler tabelltype";
			} else if (params.funk === "count") {
				resultat = GetCount.call(db, params.type, params.filter);
			} else if (params.funk === "info") {
				resultat =  GetInfo.call(db, params.type, params.filter, params.ekstra || '');
			} else if (params.funk === "merinfo") {
				resultat = GetMerInfo.call(db, params.type, params.id);
			} else {
				resultat = Sok.call(db, params, db.toJson);
			}
	
			db.con.Close();
		}
		//	res.writeHead(200, {'Content-Type': 'text/plain'});
  		res.write(resultat);
		res.end();
		
		//return resultat;

	}
	
	
	
	Util = {
			concat: function(target) {

				var args, source;
		
		
				args = Array.prototype.slice.call(arguments, 1);
				target = target || [];
				args[0] || [];
		
				for (var i = 0; i < args.length; i++) {
					source = args[i];
					if (source && source.length)
						for (var j = 0; j < source.length; j++)
							if (source[j])
								target.push(source[j]);
				}
		
				return target;
			},
		
			safe: function(str, alt) {
				var result = (str && str.length && str.toLowerCase() !== "undefined" && str.toLowerCase() !== "null") ? String(str) : (alt || '');
				return result;
			},
			
			tolkType: function(kode) {

				var t = Oppslag[kode.toLowerCase()];
				if (typeof t.select === "undefined" || !t.select)
					t.select = [t.id + ' as id', t.navn + (t.navn2 ? "&' '&" + t.navn2 : '') + ' as navn'];
				return t;
		
			},
			
//			qs: function(key) {
//				var value = Request.QueryString(key) + '';
//				return value && value !== "undefined" && value !== "null" ? value : '';
//			},
		
			toInt: function(obj, alt) {
				obj = (obj + '');
				if (!obj || isNaN(obj))
					return alt || 0;
				return parseInt(obj + '', 10);
			}
			
	};
	
	Db = function(fil) {
		var sti, cs, connection; 
		
		sti = 'c:\\htdocs\database\\'+fil;
		cs = 'Provider=Microsoft.Jet.OLEDB.4.0;Data Source='+sti+';';
		connection = new ActiveXObject('ADODB.Connection');
		connection.Open(cs);
		
		function select(sql, parameters, formatter) {
			var rs; 
			formatter = formatter || toRs;
			
			rs = connection.Execute(sql);
			
			return formatter(parameters, rs);
		}
		
		function scalar(sql) {
			return parseFloat(connection.Execute(sql).Item(0)+'', 10);
		}
		
		function toString(p, rs) {
			var antkol, arr, rows;
			if (rs.EOF)
				return '';
	
			antkol = rs.Fields.Count;
			
			rows = rs.getRows(); 
			arr = rows.toArray();
			rs.close();
			rs = null;
	
			return arr.slice(p.fra * antkol).join('|$|') + '|$|totalt|$|' + p.totalt;
		}
	
	
		function toRs(p, rs) {
			return rs;	
		}
		
		function toJson(p, recordset) {
			var obj = toJs(p, recordset);
			return JSON.stringify(obj);
		}
		
		function toJs(p, recordset) {
			var enumer, fields, records, shaper;
			
			if (recordset.BOF || recordset.EOF) 
				return [];
				
			fields = [];
			records = [];
			enumer = new Enumerator(recordset.Fields);
			shaper = function(p, c) { p[c] = recordset(c).value; return p; };
			
			
			for (; !enumer.atEnd(); enumer.moveNext()) 
			  fields.push(enumer.item().name);
			
			
			recordset.MoveFirst();
			
			while (!recordset.EOF) {
			  var item = fields.reduce(shaper, {});
	
			  records.push(item);
			  recordset.MoveNext();
			
			}
						
			return {
				poster: records,
				params: p
			}
		    
		}
		return {
			con: connection,
			scalar: scalar,
			select: select,
			toRs: toRs,
			toJs: toJs,
			toJson: toJson,
			toString: toString	
		};

	};




	Oppslag = {
		"akt": {
			tabell: "tblAktivitet",
			navn: "AktivitetsNavn",
			id: "JobbNr",
			sok: ["JobbNr", "AktivitetsNavn"],
			select: ["JobbNr", "AktivitetsNavn"],
			match: ["id"]
		},
		"anl": {
			tabell: "tblAnlegg",
			navn: "Anleggsnavn",
			id: "Anleggsnummer",
			sok: ["Anleggsnummer", "Anleggsnavn"],
			select: ["Anleggsnummer", "Anleggsnavn"],
			match: ["id"]
		},
		"ans": {
			tabell: "tblAnsatte",
			navn: "Fornavn",
			navn2: "Etternavn",
			id: "ansattnummer",
			sok: ["fornavn", "etternavn"],
			select: ["ansattnummer", "fornavn&' '&etternavn as navn"],
			match: ["ansattnummer"],
			numeriskId: true
		},
		"prl": {
			tabell: "tblAvsnitt",
			navn: "AvsnittNavn",
			id: "AvsnittsNr",
			id2: "Oppgavenr",
			sok: ["AvsnittsNr", "AvsnittNavn", "Oppgavenr"],
			match: ["id"]
		},
		"kun": {
			tabell: "tblKunder",
			navn: "Navn",
			id: "Kundenr",
			sok: ["Kundenr", "Navn"],
			select: ["Kundenr", "Navn"]
		},
		"vre": {
			tabell: "tblVarer",
			navn: "Varenavn",
			id: "varenr",
			sok: ["varenr", "Varenavn"],
			select: ["varenr", "Varenavn"]
		},
		"avd": {
			tabell: "tblAvdelinger",
			navn: "AvdelingTekst",
			id: "AvdelingID",
			sok: ["avdelingid", "avdelingtekst", "hovedavdeling"]
		},
		"kon": {
			tabell: "tblKontrakter",
			navn: "kontraktnavn",
			id: "kontraktnr",
			sok: ["kontraktnr", "kontraktnavn"]
		},
		"kan": {
			tabell: "tblKontakter",
			navn: "kontaktnavn",
			id: "kontaktnr",
			sok: ["kontaktnr", "kontaktnavn"],
			select: ["kontaktnavn", "kontaktnavn"] //	, "kundenr"]
		},
		"doc": {
			tabell: "tblDocs",
			navn: "docoverskrift",
			id: "docid",
			sok: ["docid", "docoverskrift"],
			select: ["docid", "docoverskrift"]
		},
		"pro": {
			tabell: "tblOppgaver",
			navn: "OppgaveNavn",
			id: "OppgaveNr",
			sok: ["OppgaveNr", "OppgaveNavn"],
			orderby: 'SistEndretDato DESC'
		},
		"fst": {
			tabell: "tblFasteVerdier",
			navn: "Navn",
			id: "id",
			sok: ["id", "Navn"],
			select: ["id", "Navn"],
			orderby: 'Navn',
			numeriskId: true
		}
	};


	


	
	/* p: type, query, fra, til, filter, sortering, totalt, felt */
	function Sok(p, shaper) {
		var sql, top, where, order, cnt,
			kolonner, sok, t, match;

		t = Util.tolkType(p.type);

		p.filter = Util.safe(p.filter);

		sok = Util.safe(p.query);

		top = p.til && "TOP  " + p.til || '';
		sql = "SELECT {{top}} {{kolonner}} FROM {{tabell}} WHERE {{where}} ORDER BY {{orderby}}";
		cnt = "SELECT Count(*) as totaltantall FROM {{tabell}} WHERE {{where}}";

		where = [];
		order = [p.sortering || t.orderby || t.id];
		match = Util.concat([], t.match);

		kolonner = Util.concat([], t.select, p.felt);


		if (sok && !isNaN(sok) && match.length) {
			where.push("((" + match.join("=" + sok + " OR ") + "=" + sok + ")");
		}

		if (sok && t.sok && t.sok.length) {
			if (where.length)
				where.push(" OR (" + t.sok.join(" LIKE '%" + sok + "%' OR ") + " LIKE '%" + sok + "%')) ");
			else
				where.push(" (" + t.sok.join(" LIKE '%" + sok + "%' OR ") + " LIKE '%" + sok + "%') ");
		}

		if (p.filter && p.filter.length) {
			if (where.length)
				where.push(" AND ");
			where.push("(" + p.filter + ")");
		}

		if (!where.length)
			where.push("1=1");

		top = p.til && top || '';
		kolonner = kolonner.join(',');
		where = where.length ? where.join('') : "1=1";


		sql = sql
			.replace(/{{top}}/ig, top)
			.replace(/{{kolonner}}/ig, kolonner)
			.replace(/{{tabell}}/ig, t.tabell)
			.replace(/{{where}}/ig, where)
			.replace(/{{orderby}}/ig, order);

		cnt = cnt
			.replace(/{{tabell}}/ig, t.tabell)
			.replace(/{{where}}/ig, where);

		
		
		p.totalt = p.totalt || this.scalar(cnt);
		
		return this.select(sql, p, shaper);
	}

	function GetCount(type, filter) {

		var tabell = Util.tolkType(type).tabell;
		var sql = "SELECT COUNT(*) as totaltantall FROM " + tabell + ((filter && filter.length && filter != "undefined") ? " WHERE " + filter : '');
		var cnt = this.scalar(sql);
		return cnt;
	}

	function GetInfo(type, id, filter) {
		var navn;
		var t = Util.tolkType(type);

		if (type === "kan")
			return '{"id":"' + id + '", "navn":"' + id + '"}';
		navn = t.navn + (t.navn2 ? "&' '&" + t.navn2 : '');
		var q = t.numeriskId && typeof t.numeriskId === "boolean" && t.numeriskId === true ? "" : "'";
		var sql = "SELECT " + navn + " as navn FROM " + t.tabell + " WHERE " + t.id + "=" + q + id + q + ' ' + (filter ? "AND " + filter : '');
		navn = this.scalar(sql);
//		if (!rs.EOF)
//			navn = rs("navn");
//		rs = null;

		return '{"id":"' + id + '", "navn":"' + (navn || '') + '"}';
	}



	function GetMerInfo(type, id, filter) {
		var sql, rs, res;


		sql = '';
		res = '';

		switch (type) {
			case "vre":
				sql = "SELECT varenr, varenavn, salgspris, kostpris, mva, enhet, notat FROM tblvarer where varenr='" + id + "' " + (filter || '');
				rs = this.select(sql);
				if (!rs.EOF) {
					res += '{"varenr":"' + (rs("varenr") + '').replace('null', '') + '",';
					res += '"varenavn":"' + (rs("varenavn") + '').replace('null', '') + '",';
					res += '"salgspris":"' + (rs("salgspris") + '').replace('null', '') + '",';
					res += '"kostpris":"' + (rs("kostpris") + '').replace('null', '') + '",';
					res += '"mva":"' + (rs("mva") + '').replace('null', '') + '",';
					res += '"enhet":"' + (rs("enhet") + '').replace('null', '') + '",';
					res += '"notat":"' + (rs("notat") + '').replace('null', '') + '"}';
				}
				break;
			case "kun":
				sql = "SELECT navn, Gateadresse, Postadresse, Postnr, Poststed, Betalingsbetingelser, Kontaktperson, Kundebehandler FROM tblKunder WHERE Kundenr='" + id + "'";

				rs = this.select(sql);
				if (!rs.EOF) {
					res = '{"navn":"' + (rs("navn") || '') + '", ';
					res += '"gateadresse":"' + (rs("Gateadresse") + '').replace('null', '') + '", ';
					res += '"postadresse":"' + (rs("Postadresse") + '').replace('null', '') + '", ';
					res += '"postnr":"' + (rs("Postnr") + '').replace('null', '') + '", ';
					res += '"poststed":"' + (rs("Poststed") + '').replace('null', '') + '", ';
					res += '"betalingsbetingelser":"' + (rs("Betalingsbetingelser") + '').replace('null', '') + '", ';
					res += '"kontaktperson":"' + (rs("kontaktperson") + '').replace('null', '') + '", ';
					res += '"postadresse":"' + (rs("Postadresse") + '').replace('null', '') + '", ';
					res += '"kundebehandler":"' + (rs("Kundebehandler") + '').replace('null', '') + '"}';

				}
				break;
			default:
				res = "Ukjent type: " + type;
				break;

		}



		return res;
	}
	
	
	
	/**
	 * JSON2
	 * @private
	 * Reference https://github.com/douglascrockford/JSON-js
	 */
	
	//'use strict';
	
	// Create a JSON object only if one does not already exist. We create the
	// methods in a closure to avoid creating global variables.
	if (typeof JSON !== 'object') {
	  JSON = {};
	}
	
	(function (){
	  function f(n){
	    // Format integers to have at least two digits.
	    return n < 10
	      ? '0' + n
	      : n;
	  }
	
	  function this_value(){
	    return this.valueOf();
	  }
	
	  if (typeof Date.prototype.toJSON !== 'function') {
	    Date.prototype.toJSON = function (){
	
	      return isFinite(this.valueOf())
	        ? this.getUTCFullYear() + '-' +
	      f(this.getUTCMonth() + 1) + '-' +
	      f(this.getUTCDate()) + 'T' +
	      f(this.getUTCHours()) + ':' +
	      f(this.getUTCMinutes()) + ':' +
	      f(this.getUTCSeconds()) + 'Z'
	        : null;
	    };
	
	    Boolean.prototype.toJSON = this_value;
	    Number.prototype.toJSON = this_value;
	    String.prototype.toJSON = this_value;
	  }
	
	  var cx,
	    escapable,
	    gap,
	    indent,
	    meta,
	    rep;
	
	  function quote(string){
	    // If the string contains no control characters, no quote characters, and no
	    // backslash characters, then we can safely slap some quotes around it.
	    // Otherwise we must also replace the offending characters with safe escape
	    // sequences.
	    escapable.lastIndex = 0;
	
	    return escapable.test(string)
	      ? '"' + string.replace(escapable, function (a){
	      var c = meta[a];
	      return typeof c === 'string'
	        ? c
	        : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
	    }) + '"'
	      : '"' + string + '"';
	  }
	
	  function str(key, holder){
	    // Produce a string from holder[key].
	
	    var i, // The loop counter.
	      k, // The member key.
	      v, // The member value.
	      length,
	      mind = gap,
	      partial,
	      value = holder[key];
	
	    // If the value has a toJSON method, call it to obtain a replacement value.
	    if (value && typeof value === 'object' &&
	      typeof value.toJSON === 'function') {
	      value = value.toJSON(key);
	    }
	
	    // If we were called with a replacer function, then call the replacer to
	    // obtain a replacement value.
	    if (typeof rep === 'function') {
	      value = rep.call(holder, key, value);
	    }
	
	    // What happens next depends on the value's type.
	    switch (typeof value) {
	      case 'string':
	        return quote(value);
	      case 'number':
	        // JSON numbers must be finite. Encode non-finite numbers as null.
	        return isFinite(value)
	          ? String(value)
	          : 'null';
	      case 'boolean':
	      case 'null':
	        // If the value is a boolean or null, convert it to a string. Note:
	        // typeof null does not produce 'null'. The case is included here in
	        // the remote chance that this gets fixed someday.
	        return String(value);
	      // If the type is 'object', we might be dealing with an object or an array or
	      // null.
	      case 'object':
	        // Due to a specification blunder in ECMAScript, typeof null is 'object',
	        // so watch out for that case.
	        if (!value) {
	          return 'null';
	        }
	
	        // Make an array to hold the partial results of stringifying this object value.
	        gap += indent;
	        partial = [];
	
	        // Is the value an array?
	        if (Object.prototype.toString.apply(value) === '[object Array]') {
	          // The value is an array. Stringify every element. Use null as a placeholder
	          // for non-JSON values.
	          length = value.length;
	          for (i = 0; i < length; i += 1) {
	            partial[i] = str(i, value) || 'null';
	          }
	
	          // Join all of the elements together, separated with commas, and wrap them in
	          // brackets.
	          v = partial.length === 0
	            ? '[]'
	            : gap
	            ? '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']'
	            : '[' + partial.join(',') + ']';
	          gap = mind;
	
	          return v;
	        }
	
	        // If the replacer is an array, use it to select the members to be stringified.
	        if (rep && typeof rep === 'object') {
	          length = rep.length;
	          for (i = 0; i < length; i += 1) {
	            if (typeof rep[i] === 'string') {
	              k = rep[i];
	              v = str(k, value);
	              if (v) {
	                partial.push(quote(k) + (
	                    gap
	                      ? ': '
	                      : ':'
	                  ) + v);
	              }
	            }
	          }
	        } else {
	          // Otherwise, iterate through all of the keys in the object.
	          for (k in value) {
	            if (Object.prototype.hasOwnProperty.call(value, k)) {
	              v = str(k, value);
	              if (v) {
	                partial.push(quote(k) + (
	                    gap
	                      ? ': '
	                      : ':'
	                  ) + v);
	              }
	            }
	          }
	        }
	
	        // Join all of the member texts together, separated with commas,
	        // and wrap them in braces.
	        v = partial.length === 0
	          ? '{}'
	          : gap
	          ? '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}'
	          : '{' + partial.join(',') + '}';
	        gap = mind;
	
	        return v;
	    }
	  }
	
	  // If the JSON object does not yet have a stringify method, give it one.
	  if (typeof JSON.stringify !== 'function') {
	    escapable = /[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
	    meta = { // table of character substitutions
	      '\b': '\\b',
	      '\t': '\\t',
	      '\n': '\\n',
	      '\f': '\\f',
	      '\r': '\\r',
	      '"': '\\"',
	      '\\': '\\\\'
	    };
	    JSON.stringify = function (value, replacer, space){
	      // The stringify method takes a value and an optional replacer, and an optional
	      // space parameter, and returns a JSON text. The replacer can be a function
	      // that can replace values, or an array of strings that will select the keys.
	      // A default replacer method can be provided. Use of the space parameter can
	      // produce text that is more easily readable.
	      var i;
	      gap = '';
	      indent = '';
	
	      // If the space parameter is a number, make an indent string containing that
	      // many spaces.
	      if (typeof space === 'number') {
	        for (i = 0; i < space; i += 1) {
	          indent += ' ';
	        }
	
	        // If the space parameter is a string, it will be used as the indent string.
	      } else if (typeof space === 'string') {
	        indent = space;
	      }
	
	      // If there is a replacer, it must be a function or an array.
	      // Otherwise, throw an error.
	      rep = replacer;
	
	      if (replacer && typeof replacer !== 'function' &&
	        (typeof replacer !== 'object' ||
	        typeof replacer.length !== 'number')) {
	        throw new Error('JSON.stringify');
	      }
	
	      // Make a fake root object containing our value under the key of ''.
	      // Return the result of stringifying the value.
	      return str('', { '': value });
	    };
	  }
	
	  // If the JSON object does not yet have a parse method, give it one.
	  if (typeof JSON.parse !== 'function') {
	    cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
	    JSON.parse = function (text, reviver){
	      // The parse method takes a text and an optional reviver function, and returns
	      // a JavaScript value if the text is a valid JSON text.
	      var j;
	
	      function walk(holder, key){
	        // The walk method is used to recursively walk the resulting structure so
	        // that modifications can be made.
	        var k, v, value = holder[key];
	
	        if (value && typeof value === 'object') {
	          for (k in value) {
	            if (Object.prototype.hasOwnProperty.call(value, k)) {
	              v = walk(value, k);
	              if (v !== undefined) {
	                value[k] = v;
	              } else {
	                delete value[k];
	              }
	            }
	          }
	        }
	
	        return reviver.call(holder, key, value);
	      }
	
	      // Parsing happens in four stages. In the first stage, we replace certain
	      // Unicode characters with escape sequences. JavaScript handles many characters
	      // incorrectly, either silently deleting them, or treating them as line endings.
	      text = String(text);
	      cx.lastIndex = 0;
	
	      if (cx.test(text)) {
	        text = text.replace(cx, function (a){
	          return '\\u' +
	            ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
	        });
	      }
	
	      // In the second stage, we run the text against regular expressions that look
	      // for non-JSON patterns. We are especially concerned with '()' and 'new'
	      // because they can cause invocation, and '=' because it can cause mutation.
	      // But just to be safe, we want to reject all unexpected forms.
	      // We split the second stage into 4 regexp operations in order to work around
	      // crippling inefficiencies in IE's and Safari's regexp engines. First we
	      // replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
	      // replace all simple value tokens with ']' characters. Third, we delete all
	      // open brackets that follow a colon or comma or that begin the text. Finally,
	      // we look to see that the remaining characters are only whitespace or ']' or
	      // ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.
	      if (
	        /^[\],:{}\s]*$/.test(
	          text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
	            .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
	            .replace(/(?:^|:|,)(?:\s*\[)+/g, '')
	        )
	      ) {
	        // In the third stage we use the eval function to compile the text into a
	        // JavaScript structure. The '{' operator is subject to a syntactic ambiguity
	        // in JavaScript: it can begin a block or an object literal. We wrap the text
	        // in parens to eliminate the ambiguity.
	        j = eval('(' + text + ')');
	
	        // In the optional fourth stage, we recursively walk the new structure, passing
	        // each name/value pair to a reviver function for possible transformation.
	        return typeof reviver === 'function'
	          ? walk({ '': j }, '')
	          : j;
	      }
	
	      // If the text is not JSON parseable, then a SyntaxError is thrown.
	      throw new SyntaxError('JSON.parse');
	    };
	  }
	}());


	

	
	
