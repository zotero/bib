// Copyright (c) 2009-2019 Frank Bennett
// https://github.com/Juris-M/citeproc-js/blob/abd10e78e7936495aad40fbe7e83d0db6a541b3a/src/util_name_particles.js#L240

const PARTICLE_GIVEN_REGEXP = /^([^ ]+(?:\u02bb |\u2019 | |' ) *)(.+)$/;
const PARTICLE_FAMILY_REGEXP = /^([^ ]+(?:-|\u02bb|\u2019| |') *)(.+)$/;

function splitParticles(nameValue, firstNameFlag, caseOverride) {
	// Parse particles out from name fields.
	// * nameValue (string) is the field content to be parsed.
	// * firstNameFlag (boolean) parse trailing particles
	//	 (default is to parse leading particles)
	// * caseOverride (boolean) include all but one word in particle set
	//	 (default is to include only words with lowercase first char)
	//   [caseOverride is not used in this application]
	// Returns an array with:
	// * (boolean) flag indicating whether a particle was found
	// * (string) the name after removal of particles
	// * (array) the list of particles found
	var origNameValue = nameValue;
	nameValue = caseOverride ? nameValue.toLowerCase() : nameValue;
	var particleList = [];
	var rex;
	var hasParticle;
	if (firstNameFlag) {
		nameValue = nameValue.split("").reverse().join("");
		rex = PARTICLE_GIVEN_REGEXP;
	} else {
		rex = PARTICLE_FAMILY_REGEXP;
	}
	var m = nameValue.match(rex);
	while (m) {
		var m1 = firstNameFlag ? m[1].split("").reverse().join("") : m[1];
		var firstChar = m ? m1 : false;
		firstChar = firstChar ? m1.replace(/^[-'\u02bb\u2019\s]*(.).*$/, "$1") : false;
		hasParticle = firstChar ? firstChar.toUpperCase() !== firstChar : false;
		if (!hasParticle) {
			break;
		}
		if (firstNameFlag) {
			particleList.push(origNameValue.slice(m1.length * -1));
			origNameValue = origNameValue.slice(0,m1.length * -1);
		} else {
			particleList.push(origNameValue.slice(0,m1.length));
			origNameValue = origNameValue.slice(m1.length);
		}
		//particleList.push(m1);
		nameValue = m[2];
		m = nameValue.match(rex);
	}
	if (firstNameFlag) {
		nameValue = nameValue.split("").reverse().join("");
		particleList.reverse();
		for (let i=1,ilen=particleList.length;i<ilen;i++) {
			if (particleList[i].slice(0, 1) == " ") {
				particleList[i-1] += " ";
			}
		}
		for (let i=0,ilen=particleList.length;i<ilen;i++) {
			if (particleList[i].slice(0, 1) == " ") {
				particleList[i] = particleList[i].slice(1);
			}
		}
		nameValue = origNameValue.slice(0, nameValue.length);
	} else {
		nameValue = origNameValue.slice(nameValue.length * -1);
	}
	return [hasParticle, nameValue, particleList];
}

function trimLast(str) {
	var lastChar = str.slice(-1);
	str = str.trim();
	if (lastChar === " " && ["\'", "\u2019"].indexOf(str.slice(-1)) > -1) {
		str += " ";
	}
	return str;
}

function parseSuffix(nameObj) {
	if (!nameObj.suffix && nameObj.given) {
		var m = nameObj.given.match(/(\s*,!*\s*)/);
		if (m) {
			var idx = nameObj.given.indexOf(m[1]);
			var possible_suffix = nameObj.given.slice(idx + m[1].length);
			var possible_comma = nameObj.given.slice(idx, idx + m[1].length).replace(/\s*/g, "");
			if (possible_suffix.replace(/\./g, "") === 'et al' && !nameObj["dropping-particle"]) {
				// This hack covers the case where "et al." is explicitly used in the
				// authorship information of the work.
				nameObj["dropping-particle"] = possible_suffix;
				nameObj["comma-dropping-particle"] = ",";
			} else {
				if (possible_comma.length === 2) {
					nameObj["comma-suffix"] = true;
				}
				nameObj.suffix = possible_suffix;
			}
			nameObj.given = nameObj.given.slice(0, idx);
		}
	}
}

module.exports = function parseParticles(nameObj) {
	// Extract and set non-dropping particle(s) from family name field
	var res = splitParticles(nameObj.family);
	var lastNameValue = res[1];
	var lastParticleList = res[2];
	nameObj.family = lastNameValue;
	var nonDroppingParticle = trimLast(lastParticleList.join(""));
	if (nonDroppingParticle) {
		nameObj['non-dropping-particle'] = nonDroppingParticle;
	}
	// Split off suffix first of all
	parseSuffix(nameObj);
	// Extract and set dropping particle(s) from given name field
	res = splitParticles(nameObj.given, true);
	var firstNameValue = res[1];
	var firstParticleList = res[2];
	nameObj.given = firstNameValue;
	var droppingParticle = firstParticleList.join("").trim();
	if (droppingParticle) {
		nameObj['dropping-particle'] = droppingParticle;
	}
};
