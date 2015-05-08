/* globals Session, Response, Request, Application, Server */
	
	var Util, Oppslag, Db;
	
// Production steps of ECMA-262, Edition 5, 15.4.4.21
// Reference: http://es5.github.io/#x15.4.4.21
if (!Array.prototype.reduce) {
  Array.prototype.reduce = function(callback /*, initialValue*/) {
    'use strict';
    if (this == null) {
      throw new TypeError('Array.prototype.reduce called on null or undefined');
    }
    if (typeof callback !== 'function') {
      throw new TypeError(callback + ' is not a function');
    }
    var t = Object(this), len = t.length >>> 0, k = 0, value;
    if (arguments.length == 2) {
      value = arguments[1];
    } else {
      while (k < len && !(k in t)) {
        k++; 
      }
      if (k >= len) {
        throw new TypeError('Reduce of empty array with no initial value');
      }
      value = t[k++];
    }
    for (; k < len; k++) {
      if (k in t) {
        value = callback(value, t[k], k, t);
      }
    }
    return value;
  };
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
			
			qs: function(key) {
				var value = Request.QueryString(key) + '';
				return value && value !== "undefined" && value !== "null" ? value : '';
			},
		
			toInt: function(obj, alt) {
				obj = (obj + '');
				if (!obj || isNaN(obj))
					return alt || 0;
				return parseInt(obj + '', 10);
			}
			
	};
	
	Db = function(fil) {
		var sti, cs, connection; 
		
		sti = 'c:\\htdocs\\database\\'+fil;
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
			return parseFloat(connection.Execute(sql)[0]+'', 10);
		}
		
		function single(sql) {
			return connection.Execute(sql)(0).value+'';
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
			shaper = function(p, c) { p[c] = recordset(c).Value; return p; };
			
			
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
			single: single,
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
		navn = this.single(sql);
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

	

	function requestHandler() {
		var db, resultat, params, qs;
		
		qs = Util.qs;
		db = new Db('tresamkontor_erlend.mdb');
			
		
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
			resultat = Sok.call(db, params, db.toString);
		}

		db.con.Close();
		
		return resultat;

	}
	
	Response.Write(requestHandler());
	//http.createServerFunction(requestHandler).listen(8080);
	
