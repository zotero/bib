'use strict';

const itemTypes = {
	1: 'note',
	2: 'book',
	3: 'bookSection',
	4: 'journalArticle',
	5: 'magazineArticle',
	6: 'newspaperArticle',
	7: 'thesis',
	8: 'letter',
	9: 'manuscript',
	10: 'interview',
	11: 'film',
	12: 'artwork',
	13: 'webpage',
	14: 'attachment',
	15: 'report',
	16: 'bill',
	17: 'case',
	18: 'hearing',
	19: 'patent',
	20: 'statute',
	21: 'email',
	22: 'map',
	23: 'blogPost',
	24: 'instantMessage',
	25: 'forumPost',
	26: 'audioRecording',
	27: 'presentation',
	28: 'videoRecording',
	29: 'tvBroadcast',
	30: 'radioBroadcast',
	31: 'podcast',
	32: 'computerProgram',
	33: 'conferencePaper',
	34: 'document',
	35: 'encyclopediaArticle',
	36: 'dictionaryEntry'
};

//reverse lookup
Object.keys(itemTypes).map(k => itemTypes[itemTypes[k]] = k);
export default itemTypes;
