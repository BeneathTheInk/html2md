var _ = require("underscore"),
	Entities = require("special-entities"),
	DOMUtils = require("bti-dom-utils");

var SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

var block_elements = [ "article", "aside", "blockquote", "body", "button", "canvas", "caption", "col", "colgroup", "dd", "div", "dl", "dt", "embed", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "li", "map", "object", "ol", "output", "p", "pre", "progress", "section", "table", "tbody", "textarea", "tfoot", "th", "thead", "tr", "ul", "video" ];

var markdown_block_tags = [ "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "li", "pre", "p" ];

var empty_tags = ([ "hr", "img", "video", "audio" ]).join(", ");

var markdown_inline_tags = { "b, strong": "bold", "i, em": "italic" };

var markdown_syntax = {
	"hr": "- - -\n\n",
	"br": "  \n",
	"h1": "# ",
	"h2": "## ",
	"h3": "### ",
	"h4": "#### ",
	"h5": "##### ",
	"h6": "###### ",
	"ul": "* ",
	"ol": "1. ",
	"blockquote": "> ",
	"pre": "  ",
	"p": ""
}

function html2md(doc, options) {
	return html2md.toMarkdown(html2md.parse(doc, options));
}

module.exports = html2md;

html2md.parse = function(doc, options) {
	options = options || {};

	if (typeof doc === "string") {
		doc = html2md.toDOM(doc);
	}

	var win = options.window ? options.window :
		typeof window !== "undefined" ? window :
		doc.parentWindow || doc.defaultView;

	if (win == null) {
		throw new Error("Missing window reference.");
	}

	var utils = DOMUtils(win);

	// STEP 1: Convert HTML into a set of basic blocks. Markdown organizes a
	// document into a set of blocks and unlike HTML blocks cannot contain other
	// blocks, only inline elements. This is accomplished by reducing the HTML
	// to its smallest block parts, with the assumption that block elements
	// usually define separate body's of information within an HTML document.
	//
	// Each block is given a type based on the Markdown types. This type is
	// determined from the closest ancestor with one of the following tags:
	// `blockquote`, `pre`, `li`, `hr`, `h1-6`. All other blocks become
	// paragraphs.
	//
	// This operates on a few assumptions, which outline its limitations:
	//   - Inline elements do not contain block elements.
	//   - Standard HTML block elements are used to define and separate content.

	var blocks = compactBlocks(extractBlocks(doc.body));
	
	function extractBlocks(el, blocks) {
		var lastBlock, tag;

		if (blocks == null) blocks = [];
		lastBlock = _.last(blocks);

		function addInline() {
			if (lastBlock != null) {
				lastBlock.nodes.push(el);
			} else {
				blocks.push({ type: "p", nodes: [ el ] });
			}

			return blocks;
		}

		if (el.nodeType !== 1) return addInline();

		tag = el.tagName.toLowerCase();
		
		if (!_.contains(block_elements, tag)) return addInline();

		// remove the last block if it's empty
		if (lastBlock && !lastBlock.nodes.length) blocks.pop();

		// add a new block
		blocks.push({
			type: _.contains(markdown_block_tags, tag) ? tag : "p",
			nodes: []
		});

		// process children
		_.each(el.childNodes, function(child) {
			extractBlocks(child, blocks);
		});

		return blocks;
	}

	function compactBlocks(blocks) {
		return blocks.reduce(function(m, b) {
			if (_.some(b.nodes, function(n) {
				return utils.getTextContent(n).trim() != "" ||
					(n.nodeType === 1 && (utils.matchesSelector(n, empty_tags) || n.querySelector(empty_tags)));
			})) {
				m.push(b);
			}

			return m;
		}, []);
	}

	// STEP 2: Convert inline HTML in each block into inline Markdown. Basically
	// we push each text node onto a stack, accounting for markdown specific
	// styling like italics and bold. Other inline elements like `br` and `img`
	// are preserved, but everything else is thrown out.

	blocks.forEach(function(b) {
		b.content = cleanInlines(b.nodes.reduce(function(m, n) {
			return extractInlines(n, m);
		}, []));
	});

	function extractInlines(el, inlines) {
		var lastInline, styles, content;

		if (inlines == null) inlines = [];

		switch (el.nodeType) {
			case 1:
				switch (el.tagName.toLowerCase()) {
					case "br":
						inlines.push({ type: "br" });
						break;

					case "img":
						inlines.push({
							type: "img",
							src: el.getAttribute("src")
						});
						break;

					default:
						_.each(el.childNodes, function(n) {
							extractInlines(n, inlines);
						});
						break;
				}

				break;

			case 3:
				lastInline = _.last(inlines);
				content = Entities.normalizeXML(utils.getTextContent(el), "html");
				styles = _.filter(markdown_inline_tags, function(s, sel) {
					return !!closest(el, sel);
				});

				if (lastInline && lastInline.type === "text" && _.isEqual(lastInline.styles, styles)) {
					lastInline.content += content;
				} else {
					inlines.push({
						type: "text",
						content: content,
						styles: styles
					});
				}

				break;
		}

		return inlines;
	}

	function cleanInlines(inlines) {
		// clean up whitespace and drop empty inlines
		inlines = inlines.reduce(function(m, inline, i) {
			if (inline.type !== "text") m.push(inline);
			else {
				var prev = i > 0 ? inlines[i-1] : null;

				// reduce multiple spaces to one
				inline.content = inline.content.replace(/\s+/g, " ");

				// remove leading space if previous inline has trailing space
				if (inline.content[0] === " " && prev && (
					prev.type === "br" || (
					prev.type === "text" &&
					prev.content[prev.content.length - 1] === " ")
				)) {
					inline.content = inline.content.substr(1);
				}

				// only add if this has real content
				if (inline.content) m.push(inline);
			}

			return m;
		}, []);

		// trim leading whitespace
		while (inlines.length && inlines[0].type === "text") {
			inlines[0].content = inlines[0].content.replace(/^\s+/, "");
			if (inlines[0].content) break;
			inlines.shift();
		}

		// trim trailing whitespace
		var lastInline;
		while (inlines.length && (lastInline = _.last(inlines)).type === "text") {
			lastInline.content = lastInline.content.replace(/\s+$/, "");
			if (lastInline.content) break;
			inlines.pop();
		}

		return inlines;
	}

	function closest(el, selector) {
		while (el != null) {
			if (el.nodeType === 1 && utils.matchesSelector(el, selector)) return el;
			el = el.parentNode;
		}

		return null;
	}

	// STEP 3: The last step is clean up before returning the result.

	// clean
	blocks = blocks.filter(function(b) { return b.content.length; });
	blocks.forEach(function(b) { delete b.nodes; });

	return blocks;
}

html2md.toMarkdown = function(tree) {
	return tree.map(function(block) {
		var content = block.content.map(convertInline).join("");

		switch (block.type) {
			case "blockquote":
			case "pre":
			case "p":
			case "h1":
			case "h2":
			case "h3":
			case "h4":
			case "h5":
			case "h6":
				return (markdown_syntax[block.type] || "") + content;
		}
	}).join("\n\n");

	function convertInline(inline) {
		switch (inline.type) {
			case "text": return inline.content;
			case "br": return markdown_syntax.br;
			case "img": return "![](" + inline.src + ")";
		}
	}
}

html2md.toDOM = function(html) {
	var doc;

	// clean html before we parse
	html = html.replace(SCRIPT_REGEX, '');
	html = Entities.normalizeXML(html, 'xhtml');

	// browsers
	if (typeof window !== "undefined" && window.document) {
		var doc = window.document.implementation.createHTMLDocument();
		doc.innerHTML = html;
	}

	// nodejs
	else {
		doc = require("jsdom").jsdom(html);
	}

	return doc;
}