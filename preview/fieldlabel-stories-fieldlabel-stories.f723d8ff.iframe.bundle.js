(globalThis.webpackChunk_spectrum_css_preview=globalThis.webpackChunk_spectrum_css_preview||[]).push([[3239],{"../../components/fieldlabel/stories/template.js":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{"use strict";__webpack_require__.d(__webpack_exports__,{Y:()=>Template});var lit=__webpack_require__("../../node_modules/lit/index.js"),class_map=__webpack_require__("../../node_modules/lit/directives/class-map.js"),style_map=__webpack_require__("../../node_modules/lit/directives/style-map.js"),if_defined=__webpack_require__("../../node_modules/lit/directives/if-defined.js"),template=__webpack_require__("../../components/icon/stories/template.js"),injectStylesIntoLinkTag=__webpack_require__("../../node_modules/style-loader/dist/runtime/injectStylesIntoLinkTag.js"),injectStylesIntoLinkTag_default=__webpack_require__.n(injectStylesIntoLinkTag),insertBySelector=__webpack_require__("../../node_modules/style-loader/dist/runtime/insertBySelector.js"),insertBySelector_default=__webpack_require__.n(insertBySelector),fieldlabel=__webpack_require__("../../node_modules/file-loader/dist/cjs.js??ruleSet[1].rules[12].use[1]!../../node_modules/postcss-loader/dist/cjs.js??ruleSet[1].rules[12].use[2]!../../components/fieldlabel/index.css"),fieldlabel_default=__webpack_require__.n(fieldlabel),options={attributes:{"data-source":"processed"}};options.insert=insertBySelector_default().bind(null,"head");injectStylesIntoLinkTag_default()(fieldlabel_default(),options);const Template=({rootClass="spectrum-FieldLabel",customClasses=[],size="m",label,id,forInput,alignment,isDisabled,isRequired,style={},...globals})=>{if(!label)return console.warn("FieldLabel: please provide a label for the field label."),lit.dy``;const{express}=globals;try{express?__webpack_require__.e(1435).then(__webpack_require__.bind(__webpack_require__,"../../components/fieldlabel/themes/express.css")):__webpack_require__.e(3018).then(__webpack_require__.bind(__webpack_require__,"../../components/fieldlabel/themes/spectrum.css"))}catch(e){console.warn(e)}let iconName="Asterisk100";switch(size){case"s":default:iconName="Asterisk100";break;case"l":iconName="Asterisk200";break;case"xl":iconName="Asterisk300"}return lit.dy`
		<label
			class=${(0,class_map.$)({[rootClass]:!0,[`${rootClass}--size${size?.toUpperCase()}`]:void 0!==size,[`${rootClass}--${alignment}`]:void 0!==alignment,"is-disabled":isDisabled,...customClasses.reduce(((a,c)=>({...a,[c]:!0})),{})})}
			style=${(0,if_defined.o)((0,style_map.V)(style))}
			id=${(0,if_defined.o)(id)}
			for=${(0,if_defined.o)(forInput)}
		>
			${label}
			${isRequired?(0,template.Y)({...globals,size,iconName,customClasses:[`${rootClass}-UIIcon`]}):""}
		</label>
	`}},"../../components/fieldlabel/stories/fieldlabel.stories.js":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{"use strict";__webpack_require__.r(__webpack_exports__),__webpack_require__.d(__webpack_exports__,{Default:()=>Default,RightAligned:()=>RightAligned,__namedExportsOrder:()=>__namedExportsOrder,default:()=>__WEBPACK_DEFAULT_EXPORT__});var _template__WEBPACK_IMPORTED_MODULE_0__=__webpack_require__("../../components/fieldlabel/stories/template.js");const __WEBPACK_DEFAULT_EXPORT__={title:"Components/Field label",description:"The Field label component is used along with inputs to display a label for that input.",component:"Fieldlabel",argTypes:{size:{name:"Size",type:{name:"string",required:!0},table:{type:{summary:"string"},category:"Component"},options:["s","m","l","xl"],control:"select"},label:{name:"Label",type:{name:"string"},table:{type:{summary:"string"},category:"Content"},control:{type:"text"}},alignment:{name:"Alignment",type:{name:"string"},table:{type:{summary:"string"},category:"Component"},options:["left","right"],control:"select"},isDisabled:{name:"Disabled",type:{name:"boolean"},table:{type:{summary:"boolean"},category:"State"},control:"boolean"},isRequired:{name:"Required",type:{name:"boolean"},table:{type:{summary:"boolean"},category:"State"},control:"boolean"}},args:{rootClass:"spectrum-FieldLabel",size:"m",alignment:"left",isDisabled:!1,isRequired:!1},parameters:{actions:{handles:[]},status:{type:["accordion","actionbar","actionbutton","actiongroup","actionmenu","alertbanner","alertdialog","avatar","badge","breadcrumb","button","buttongroup","calendar","card","checkbox","clearbutton","closebutton","colorarea","colorhandle","colorloupe","colorslider","colorwheel","combobox","contextualhelp","divider","dropzone","fieldgroup","fieldlabel","floatingactionbutton","helptext","illustratedmessage","infieldbutton","inlinealert","link","menu","opacitycheckerboard","page","picker","pickerbutton","popover","progressbar","progresscircle","radio","rating","search","sidenav","slider","splitview","stepper","swatch","swatchgroup","switch","table","tabs","tag","taggroup","textfield","thumbnail","toast","tooltip","tray","typography","underlay","well"].includes("fieldlabel")?"migrated":void 0}}},Default=_template__WEBPACK_IMPORTED_MODULE_0__.Y.bind({});Default.args={label:"Label"};const RightAligned=_template__WEBPACK_IMPORTED_MODULE_0__.Y.bind({});RightAligned.args={label:"Label",alignment:"right",style:{width:"72px"}};const __namedExportsOrder=["Default","RightAligned"]},"../../node_modules/lit-html/directives/style-map.js":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{"use strict";__webpack_require__.d(__webpack_exports__,{V:()=>o});var _lit_html_js__WEBPACK_IMPORTED_MODULE_0__=__webpack_require__("../../node_modules/lit-html/lit-html.js"),_directive_js__WEBPACK_IMPORTED_MODULE_1__=__webpack_require__("../../node_modules/lit-html/directive.js"),i="important",n=" !"+i,o=(0,_directive_js__WEBPACK_IMPORTED_MODULE_1__.XM)(class extends _directive_js__WEBPACK_IMPORTED_MODULE_1__.Xe{constructor(t){var e;if(super(t),t.type!==_directive_js__WEBPACK_IMPORTED_MODULE_1__.pX.ATTRIBUTE||"style"!==t.name||(null===(e=t.strings)||void 0===e?void 0:e.length)>2)throw Error("The `styleMap` directive must be used in the `style` attribute and must be the only part in the attribute.")}render(t){return Object.keys(t).reduce(((e,r)=>{var s=t[r];return null==s?e:e+"".concat(r=r.includes("-")?r:r.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g,"-$&").toLowerCase(),":").concat(s,";")}),"")}update(e,_ref){var[r]=_ref,{style:s}=e.element;if(void 0===this.ht){for(var _t in this.ht=new Set,r)this.ht.add(_t);return this.render(r)}for(var _t2 in this.ht.forEach((t=>{null==r[t]&&(this.ht.delete(t),t.includes("-")?s.removeProperty(t):s[t]="")})),r){var _e=r[_t2];if(null!=_e){this.ht.add(_t2);var _r="string"==typeof _e&&_e.endsWith(n);_t2.includes("-")||_r?s.setProperty(_t2,_r?_e.slice(0,-11):_e,_r?i:""):s[_t2]=_e}}return _lit_html_js__WEBPACK_IMPORTED_MODULE_0__.Jb}})},"../../node_modules/lit/directives/style-map.js":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{"use strict";__webpack_require__.d(__webpack_exports__,{V:()=>lit_html_directives_style_map_js__WEBPACK_IMPORTED_MODULE_0__.V});var lit_html_directives_style_map_js__WEBPACK_IMPORTED_MODULE_0__=__webpack_require__("../../node_modules/lit-html/directives/style-map.js")},"../../node_modules/file-loader/dist/cjs.js??ruleSet[1].rules[12].use[1]!../../node_modules/postcss-loader/dist/cjs.js??ruleSet[1].rules[12].use[2]!../../components/fieldlabel/index.css":(module,__unused_webpack_exports,__webpack_require__)=>{module.exports=__webpack_require__.p+"assets/css/components/fieldlabel/index.css"}}]);
//# sourceMappingURL=fieldlabel-stories-fieldlabel-stories.f723d8ff.iframe.bundle.js.map