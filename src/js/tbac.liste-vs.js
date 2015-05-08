(function ($) {



        $.fn.tbliste = function (options) {

            return this.each(function () {
                $(this).data("tbliste", new TbListe(this, options));
            });

        };

        var TbListe = function(element, options) {

            this.options = $.extend(true, {}, $.fn.tbliste.defaults, options);
            this.$element = $(element);
            this.$viewport = this.$element.find('.tbliste-viewport').length ? this.$element.find('.tbliste-viewport') : $('<div class"tbliste-viewport"></div>').appendTo(this.$element);
            this.$viewport.css({
                                "overflow-x": "hidden",
                                "overflow-y": "auto",
                                "position": "relative",
                                "width": "100%",
                                "height": "300px"
                                //, "max-height": "100%"
                            });

            this.$canvas = this.$viewport.find('.tbliste-canvas').length ? this.$viewport.find('.tbliste-canvas') : $('<ul class="tbliste-canvas"></ul>').appendTo(this.$viewport);

            this.$canvas.css({
                                "-webkit-transform": "translate3d(0px, 0px, 0px)",
                                "display": "block",
                                "margin": "0",
                                "padding": "0",
                                "list-style": "none",
                                "left": 0,
                                "top": 0
                        });
            this.canvasHeight = null;
            this.height = null;
            this.scrollDir = 1;
            this.prevScrollTop = 0;
            this.scrollTop = 0;
            this.viewportHeight = 0;
            this.allRowsCache = [];
            this.vc = [];
            this.top = 0;
            this.getItemRenderer = this.options.getItemRenderer || this.getItemRenderer;
            this.itemRenderer = this.options.itemRenderer || this.itemRenderer;
            this.getItems = this.options.getItems || this.getItems;
            this.getSelected = this.options.getSelected || this.getSelected;
            this.lastRenderedScrollTop = 0;
            this.stimeout = null;
            this.closeTimeout = null;
            this.shown = false;
            this.multiselect = false;

            this.active = null;
            this.selected = null;
            this.listen();

            this.$element.data('tbliste', this);
        };

        TbListe.prototype = {
            constructor: TbListe,

            aktiver: function(el) {
                var a = this.active || this.finnElementMed(false, "active");

                if (a)
                    a.removeClass('active');


                if (el)
                    this.active = el.addClass('active');
                else
                    this.active = null;

                return this.active;

            },
            select: function(el) {



                var s = el || this.finnElementMed(false, "selected") || this.finnElementMed(false, "active");

                if (s) {
                    if (s.hasClass("active"))
                    {
                        this.active.removeClass('active');
                        this.active = null;
                    }
                    s.addClass("selected");
                }


                this.selected = s;


                return this.selected;
            },
            clear: function() {
                this.items = [];
                this.cleanupRows();

                for (var i = 0, _len2 = this.allRowsCache.length; i < _len2; i++)
                    delete this.allRowsCache[i];

                this.$viewport.scrollTop(0);

                //this.$canvas.empty();
                this.resizeCanvas();
                return this;
            },
            move: function(dir) {
                this.$viewport.scrollTop(this.prevScrollTop + (dir * this.options.rowHeight));
            },
            finnElementMed: function(id, klasse) {

                if (klasse)
                {
                    if (klasse == "active" && this.active)
                        return this.actvie;
                    if (klasse === "selected" && this.selected)
                        return this.selected;
                }

                var i = this.finnIndexFor(id, klasse);
                return i>=0 ? this.vc[i] : null;
            },
            finnIndexFor: function(id, klasse) {
                var vc = this.vc;


                for (var i = 0, l = vc.length; i < l; i++)
                    if (vc[i] && (klasse && vc[i].hasClass(klasse) || id && (vc[i].id == id)))
                        return i;
                return -1;
            },
            getItems: function () { return this.items || []; },
            getSelected: function() { return []; },
            //getItemRenderer: function() { return this.itemRenderer; },
            getItemRenderer: function(query) {
                        var rx = query ? new RegExp('(' + query + ')', 'ig') : null;
                        return function(item, index) {
                                return $.tmpl("tbacitem", item, {
                                    hl: function(t) { return !rx ? t : $.trim(String(t).replace(rx, function($1, match) { return '<strong>' + match + '</strong>'; }) || '') || t; },
                                    index: index
                                }).data("item", item);
                        };
            },
            itemRenderer: function(item, index) { return $('<div class="tbac-item tbliste-item" data-tbliste-index="'+index+'">'+(item.id || '')+' ' + (item.navn || '') + '</div>').data('item', item); },
            neste: function () { this.step(1); },
            forrige: function () { this.step(-1); },
            step: function (dir) {
                //console.log("STEP: ", dir)
                var index, range, vc, a, s, neste;
                vc = this.vc;
                index = -1;
                neste = 0;
                range = this.getVisibleRange();
                a = this.active || this.finnElementMed(false, "active");
                s = this.selected;
                if (a) {
                    index = vc.indexOf(a);
                    neste = index+dir;
                }

                this.aktiver(vc[neste]);

                if (neste >= range.bottom)
                    this.move(neste === range.bottom ? 1 : neste - range.bottom);
                else if (neste < range.top)
                    this.move(neste === range.top ? -1 : neste - range.top);
            },

            cleanupRows: function(rangeToKeep) {
                rangeToKeep = rangeToKeep || { top: 0, bottom: this.vc.length };
                for (var i = rangeToKeep.top, _len = Math.min(this.vc.length, rangeToKeep.bottom); i < _len; i++)
                    this.removeRowFromCache(i);
                //if (i < rangeToKeep.top || i > rangeToKeep.bottom)
            },

            removeRowFromCache: function(row) {
                var node = this.vc[row];
                if (node != null) {
                    node.detach();
                    delete this.vc[row];
                }
            },
            resizeCanvas: function() {
                this.viewportHeight = parseFloat($.css(this.$viewport[0], "height", true));
                var oldHeight = this.height;

                this.canvasHeight = Math.max(this.options.rowHeight * (this.totalt || (this.items && this.items.length)), this.viewportHeight);
                this.height = this.canvasHeight;

                if (this.height !== oldHeight) {
                    this.$canvas.css("height", this.height);
                    this.scrollTop = this.getScrollPosition().top;
                }
                return this;
            },

            getVisibleRange: function(viewportTop) {
                if (viewportTop == null)
                    viewportTop = this.scrollTop;

                return {
                    top: Math.floor((viewportTop) / this.options.rowHeight),
                    bottom: Math.ceil((viewportTop + this.viewportHeight) / this.options.rowHeight)
                };
            },
            getRenderedRange: function(viewportTop) {
                var buffer, range;
                range = this.getVisibleRange(viewportTop);
                buffer = Math.round(this.viewportHeight / this.options.rowHeight);

                range.top -= this.scrollDir === -1 ? buffer : this.options.minBuffer;
                range.bottom += this.scrollDir === 1 ? buffer : this.options.minBuffer;

                range.top = Math.max(0, range.top);
                //range.bottom = Math.max(100, Math.min((this.items && this.items.length || 1) - 1, range.bottom));
                return range;
            },
            renderRows: function(range, items) {
                var child, d, element, elementArray, i, needToReselectCell, rowHeight, rows, top, _len, data, renderer, selected;
                elementArray = [];
                rows = [];
                needToReselectCell = false;
                i = range.top;

                var self = this;
                rowHeight = this.options.rowHeight;
                // if (typeof items === "undefined")
                //     items = this.items;

                if (typeof items === "undefined")
                {
                    if (this.req && this.req.abort)
                        this.req.abort();
                    console.log("items: ", items);
                    this.req = this.getItems(range);

                }
                else {
                    data = items;
                    selected = this.getSelected();
                    renderer = this.getItemRenderer();
                    while (i <= range.bottom) {
                        if (!this.vc[i]) {
                            d = data[i];
                            if (d) {
                                rows.push(i);
                                top = (rowHeight * i) + "px";
                                element = this.allRowsCache[i] || renderer(d, i);
                                element.css({
                                    top: top,
                                    height: rowHeight + "px",
                                    //lineHeight: rowHeight + "px",
                                    position: 'absolute'
                                }).addClass('tbliste-item');
                                needToReselectCell = !!selected[d.id];

                                if (needToReselectCell === true)
                                    element.addClass("selected");

                                else
                                    element.removeClass("selected");

                                elementArray.push(element);
                            }
                        }
                        i++;
                    }
                    for (i = 0, _len = elementArray.length; i < _len; i++) {
                        child = elementArray[i];
                        this.vc[rows[i]] = this.allRowsCache[rows[i]] = $(child).appendTo(this.$canvas);
                    }


                }
            },

            render: function(vp) {
                var rendered = this.getRenderedRange(vp);
                this.cleanupRows(rendered);
                this.renderRows(rendered);

            },
            handleScroll: function() {

                this.scrollTop = this.getScrollPosition().top;
                var scrollDist = Math.abs(this.scrollTop - this.prevScrollTop);
                if (scrollDist) {
                    this.scrollDir = this.prevScrollTop < this.scrollTop ? 1 : -1;
                    this.prevScrollTop = this.scrollTop;

                    if (this.stimeout)
                        clearTimeout(this.stimeout);

                    if (Math.abs(this.lastRenderedScrollTop - this.scrollTop) < this.viewportHeight)
                        {
                            this.lastRenderedScrollTop = this.scrollTop;
                            return this.render(this.scrollTop);
                        }
                    else
                        this.stimeout = setTimeout(this.render.bind(this, this.scrollTop), 50);
                }
            },
            getScrollPosition: function() {
                var matrix;
                switch (this.options.scrollMethod) {
                case "transform":
                    matrix = this.$canvas.css("-webkit-transform").toString().match(/matrix\(\s*([^\s]+),\s*([^\s]+),\s*([^\s]+),\s*([^\s]+),\s*([^\s]+),\s*([^\s]+)\s*\)/) || [];
                    return {
                        top: parseInt(-(matrix[6] || 0)),
                        left: parseInt(-(matrix[5] || 0))
                    };
                default:
                    return {
                        top: this.$viewport[0].scrollTop
                    };
                }
            },
            mouseenter: function(e) {
                this.$viewport.find('.mactive').removeClass('mactive');
                $(e.currentTarget).addClass('mactive');
                //if (!$e.hasClass('gruppe') && !$e.hasClass('ingentreff'))

            },

            listen: function () {
                // Finn: \$\.proxy\(([\.\w+]+)\,\sthis
                // Replace: $1.bind(this
                this.$viewport
                    .on("mouseenter", ".tbliste-item:not(.gruppe)", this.mouseenter.bind(this))
                    .on("scroll", this.handleScroll.bind(this));
                this.$element
                    .on("clear", this.clear.bind(this))
                    .on("render", this.render.bind(this))
                    .on("neste", this.neste.bind(this))
                    .on("forrige", this.forrige.bind(this));
            }
        };

        $.fn.tbliste.Constructor = TbListe;
        $.fn.tbliste.defaults = {
            rowHeight: 26,
            scrollMethod: "scroll",
            minBuffer: 5,
            itemRenderer: null,
            getItems: null,
            getItemRenderer: null,
            getSelected: null,
            antallItems: 8,
            bredde: 300,
            autobredde: true
        };

})(jQuery);
