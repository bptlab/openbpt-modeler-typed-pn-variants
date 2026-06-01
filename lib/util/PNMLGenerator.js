const { DOMParser, XMLSerializer } = require('xmldom');

function unclutter(modelElements) {
	const places = modelElements.filter(el => el.$type === 'tpn:Place');
	const transitions = modelElements.filter(el => el.$type === 'tpn:Transition');
	const arcs = modelElements.filter(el => el.$type === 'tpn:Arc');
	return {places, transitions, arcs};
}

export function exportModelToPNML(definitions) {
	const {places, transitions, arcs} = unclutter(definitions.model.modelElements);
	const modelName = definitions.model.name || "This is a PNML representation of the (D)OPID model."; 
	const variables = null

    const doc = new DOMParser().parseFromString('<pnml></pnml>', 'text/xml');
    const root = doc.documentElement;
    
    const net = doc.createElement('net');
    net.setAttribute('id', 'net1');
    net.setAttribute('type', 'http://www.pnml.org/version-2009/grammar/pnmlcoremodel');
    root.appendChild(net);

    const page = doc.createElement('page');
    page.setAttribute('id', 'page1');
    net.appendChild(page);

    const name = doc.createElement('name');
    const text = doc.createElement('text');
    text.appendChild(doc.createTextNode(modelName));
    name.appendChild(text);
    page.appendChild(name);

    for (const place of places) {
		const placeElement = doc.createElement('place');
		placeElement.setAttribute('id', place.id);
        const colors = (place.color || []).map(c => c.name.toUpperCase()).join(',');
		placeElement.setAttribute('colors', colors);
		if (place.name) {
			const placeName = doc.createElement('name');
			const placeText = doc.createElement('text');
			placeText.appendChild(doc.createTextNode(place.name));
			placeName.appendChild(placeText);
			placeElement.appendChild(placeName);
		}
		if (place.marking) {
			const marking = doc.createElement('initialMarking');
			const markingText = doc.createElement('text');
			markingText.appendChild(doc.createTextNode(place.marking.length.toString()));
			marking.appendChild(markingText);
			placeElement.appendChild(marking);
		}
		page.appendChild(placeElement);
    }

    for (const transition of transitions) {
		const transitionElement = doc.createElement('transition');
		transitionElement.setAttribute('id', transition.id);
		if (transition.name) {
			const transitionName = doc.createElement('name');
			const transitionText = doc.createElement('text');
			transitionText.appendChild(doc.createTextNode(transition.name));
			transitionName.appendChild(transitionText);
			transitionElement.appendChild(transitionName);
		}
		page.appendChild(transitionElement);
	}

    for (const arc of arcs) {
		if (arc.isInhibitorArc)
			continue; // Skip inhibitor arcs for now, as PNML does not have a standard way to represent them
		const arcElement = doc.createElement('arc');
		arcElement.setAttribute('source', arc.source.id);
		arcElement.setAttribute('target', arc.target.id);

		const variableType = arc.variableType ? arc.variableType.name : 'undefined';
		const inscription = (arc.inscription.inscriptionElements || []).map(i => {
			const variableName = i.isGenerated ? 'nu' : i.variableName;
			const typeName = i.dataClass.name === variableType ? i.dataClass.name.toUpperCase()+' LIST' : i.dataClass.name.toUpperCase();
			return `${variableName}:${typeName}`;
		}).join(',');
		arcElement.setAttribute('inscription', inscription);

		if (arc.isExactSynchronization) {
			arcElement.setAttribute('synchronization', 'exact');
		}
		page.appendChild(arcElement);
	}

    const variablesElement = doc.createElement('variables');
    net.appendChild(variablesElement);

    const serializer = new XMLSerializer();
    const rawXmlString = serializer.serializeToString(doc);
    
    const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';

    return xmlDeclaration + formatXML(rawXmlString);
}

function formatXML(xml) {
    let formatted = '';
    let reg = /(>)(<)(\/*)/g;
    xml = xml.replace(reg, '$1\r\n$2$3');
    let pad = 0;
    
    xml.split('\r\n').forEach((node) => {
        let indent = 0;
        if (node.match( /.+<\/\w[^>]*>$/ )) {
            indent = 0;
        } else if (node.match( /^<\/\w/ )) {
            if (pad !== 0) pad -= 1;
        } else if (node.match( /^<\w[^>]*[^\/]>.*$/ )) {
            indent = 1;
        } else {
            indent = 0;
        }

        formatted += '  '.repeat(pad) + node + '\r\n';
        pad += indent;
    });

    return formatted.trim();
}