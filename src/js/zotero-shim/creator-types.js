'use strict';

const creatorTypes = {
	1: 'author',
	2: 'contributor',
	3: 'editor',
	4: 'translator',
	5: 'seriesEditor',
	6: 'interviewee',
	7: 'interviewer',
	8: 'director',
	9: 'scriptwriter',
	10: 'producer',
	11: 'castMember',
	12: 'sponsor',
	13: 'counsel',
	14: 'inventor',
	15: 'attorneyAgent',
	16: 'recipient',
	17: 'performer',
	18: 'composer',
	19: 'wordsBy',
	20: 'cartographer',
	21: 'programmer',
	22: 'artist',
	23: 'commenter',
	24: 'presenter',
	25: 'guest',
	26: 'podcaster',
	27: 'reviewedAuthor',
	28: 'cosponsor',
	29: 'bookAuthor'
};


//reverse lookup
Object.keys(creatorTypes).map(k => creatorTypes[creatorTypes[k]] = k);
module.exports = creatorTypes;
