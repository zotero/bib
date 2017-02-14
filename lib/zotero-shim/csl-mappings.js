'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.default = {
	CSL_NAMES_MAPPINGS: {
		'author': 'author',
		'editor': 'editor',
		'bookAuthor': 'container-author',
		'composer': 'composer',
		'director': 'director',
		'interviewer': 'interviewer',
		'recipient': 'recipient',
		'reviewedAuthor': 'reviewed-author',
		'seriesEditor': 'collection-editor',
		'translator': 'translator'
	},

	/*
  * Mappings for text variables
  */
	CSL_TEXT_MAPPINGS: {
		'title': ['title'],
		'container-title': ['publicationTitle', 'reporter', 'code'], /* reporter and code should move to SQL mapping tables */
		'collection-title': ['seriesTitle', 'series'],
		'collection-number': ['seriesNumber'],
		'publisher': ['publisher', 'distributor'], /* distributor should move to SQL mapping tables */
		'publisher-place': ['place'],
		'authority': ['court', 'legislativeBody', 'issuingAuthority'],
		'page': ['pages'],
		'volume': ['volume', 'codeNumber'],
		'issue': ['issue', 'priorityNumbers'],
		'number-of-volumes': ['numberOfVolumes'],
		'number-of-pages': ['numPages'],
		'edition': ['edition'],
		'version': ['versionNumber'],
		'section': ['section', 'committee'],
		'genre': ['type', 'programmingLanguage'],
		'source': ['libraryCatalog'],
		'dimensions': ['artworkSize', 'runningTime'],
		'medium': ['medium', 'system'],
		'scale': ['scale'],
		'archive': ['archive'],
		'archive_location': ['archiveLocation'],
		'event': ['meetingName', 'conferenceName'], /* these should be mapped to the same base field in SQL mapping tables */
		'event-place': ['place'],
		'abstract': ['abstractNote'],
		'URL': ['url'],
		'DOI': ['DOI'],
		'ISBN': ['ISBN'],
		'ISSN': ['ISSN'],
		'call-number': ['callNumber', 'applicationNumber'],
		'note': ['extra'],
		'number': ['number'],
		'chapter-number': ['session'],
		'references': ['history', 'references'],
		'shortTitle': ['shortTitle'],
		'journalAbbreviation': ['journalAbbreviation'],
		'status': ['legalStatus'],
		'language': ['language']
	},
	CSL_DATE_MAPPINGS: {
		'issued': 'date',
		'accessed': 'accessDate',
		'submitted': 'filingDate'
	},
	CSL_TYPE_MAPPINGS: {
		'book': 'book',
		'bookSection': 'chapter',
		'journalArticle': 'article-journal',
		'magazineArticle': 'article-magazine',
		'newspaperArticle': 'article-newspaper',
		'thesis': 'thesis',
		'encyclopediaArticle': 'entry-encyclopedia',
		'dictionaryEntry': 'entry-dictionary',
		'conferencePaper': 'paper-conference',
		'letter': 'personal_communication',
		'manuscript': 'manuscript',
		'interview': 'interview',
		'film': 'motion_picture',
		'artwork': 'graphic',
		'webpage': 'webpage',
		'report': 'report',
		'bill': 'bill',
		'case': 'legal_case',
		'hearing': 'bill', // ??
		'patent': 'patent',
		'statute': 'legislation', // ??
		'email': 'personal_communication',
		'map': 'map',
		'blogPost': 'post-weblog',
		'instantMessage': 'personal_communication',
		'forumPost': 'post',
		'audioRecording': 'song', // ??
		'presentation': 'speech',
		'videoRecording': 'motion_picture',
		'tvBroadcast': 'broadcast',
		'radioBroadcast': 'broadcast',
		'podcast': 'song', // ??
		'computerProgram': 'book', // ??
		'document': 'article',
		'note': 'article',
		'attachment': 'article'
	}
};
module.exports = exports['default'];