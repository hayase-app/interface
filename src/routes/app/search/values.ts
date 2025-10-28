export const genres = [
  {
    value: 'Action',
    label: 'Action'
  },
  {
    value: 'Adventure',
    label: 'Adventure'
  },
  {
    value: 'Comedy',
    label: 'Comedy'
  },
  {
    value: 'Drama',
    label: 'Drama'
  },
  {
    value: 'Ecchi',
    label: 'Ecchi'
  },
  {
    value: 'Fantasy',
    label: 'Fantasy'
  },
  {
    value: 'Horror',
    label: 'Horror'
  },
  {
    value: 'Mahou Shoujo',
    label: 'Mahou Shoujo'
  },
  {
    value: 'Mecha',
    label: 'Mecha'
  },
  {
    value: 'Music',
    label: 'Music'
  },
  {
    value: 'Mystery',
    label: 'Mystery'
  },
  {
    value: 'Psychological',
    label: 'Psychological'
  },
  {
    value: 'Romance',
    label: 'Romance'
  },
  {
    value: 'Sci-Fi',
    label: 'Sci-Fi'
  },
  {
    value: 'Slice of Life',
    label: 'Slice of Life'
  },
  {
    value: 'Sports',
    label: 'Sports'
  },
  {
    value: 'Supernatural',
    label: 'Supernatural'
  },
  {
    value: 'Thriller',
    label: 'Thriller'
  }
] as const

const currentYear = new Date().getFullYear()
export const years = Array.from({ length: currentYear - 1940 + 2 }, (_, i) => '' + (currentYear + 2 - i)).map(value => ({ value, label: value }))

export const seasons = [
  {
    value: 'SPRING',
    label: 'Spring'
  },
  {
    value: 'SUMMER',
    label: 'Summer'
  },
  {
    value: 'FALL',
    label: 'Fall'
  },
  {
    value: 'WINTER',
    label: 'Winter'
  }
] as const

export const formats = [
  {
    value: 'TV',
    label: 'TV Show'
  },
  {
    value: 'MOVIE',
    label: 'Movie'
  },
  {
    value: 'TV_SHORT',
    label: 'TV Short'
  },
  {
    value: 'OVA',
    label: 'OVA'
  },
  {
    value: 'ONA',
    label: 'ONA'
  }
] as const

export const status = [
  {
    value: 'RELEASING',
    label: 'Airing'
  },
  {
    value: 'FINISHED',
    label: 'Finished'
  },
  {
    value: 'NOT_YET_RELEASED',
    label: 'Not Yet Aired'
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled'
  }
] as const

export const sort = [
  {
    value: 'TITLE_ROMAJI_DESC',
    label: 'Name'
  },
  {
    value: 'START_DATE_DESC',
    label: 'Release Date'
  },
  {
    value: 'SCORE_DESC',
    label: 'Score'
  },
  {
    value: 'POPULARITY_DESC',
    label: 'Popularity'
  },
  {
    value: 'TRENDING_DESC',
    label: 'Trending'
  },
  {
    value: 'UPDATED_AT_DESC',
    label: 'Updated Date'
  },
  {
    value: 'TITLE_ROMAJI',
    label: 'Name Asc'
  },
  {
    value: 'START_DATE',
    label: 'Release Date Asc'
  },
  {
    value: 'SCORE',
    label: 'Score Asc'
  },
  {
    value: 'POPULARITY',
    label: 'Popularity Asc'
  },
  {
    value: 'TRENDING',
    label: 'Trending Asc'
  },
  {
    value: 'UPDATED_AT',
    label: 'Updated Date Asc'
  }
] as const

export const onlist = [
  {
    value: 'true',
    label: 'On List'
  },
  {
    value: 'false',
    label: 'Not On List'
  }
] as const

export const tags = [
  '4-koma',
  'Achromatic',
  'Achronological Order',
  'Acrobatics',
  'Acting',
  'Adoption',
  'Advertisement',
  'Afterlife',
  'Age Gap',
  'Age Regression',
  'Agender',
  'Agriculture',
  'Airsoft',
  'Alchemy',
  'Aliens',
  'Alternate Universe',
  'American Football',
  'Amnesia',
  'Anachronism',
  'Ancient China',
  'Angels',
  'Animals',
  'Anthology',
  'Anthropomorphism',
  'Anti-Hero',
  'Archery',
  'Aromantic',
  'Arranged Marriage',
  'Artificial Intelligence',
  'Asexual',
  'Assassins',
  'Astronomy',
  'Athletics',
  'Augmented Reality',
  'Autobiographical',
  'Aviation',
  'Badminton',
  'Ballet',
  'Band',
  'Bar',
  'Baseball',
  'Basketball',
  'Battle Royale',
  'Biographical',
  'Bisexual',
  'Blackmail',
  'Board Game',
  'Boarding School',
  'Body Horror',
  'Body Image',
  'Body Swapping',
  'Bowling',
  'Boxing',
  'Boys\' Love',
  'Bullying',
  'Butler',
  'Calligraphy',
  'Camping',
  'Cannibalism',
  'Card Battle',
  'Cars',
  'Centaur',
  'CGI',
  'Cheerleading',
  'Chibi',
  'Chimera',
  'Chuunibyou',
  'Circus',
  'Class Struggle',
  'Classic Literature',
  'Classical Music',
  'Clone',
  'Coastal',
  'Cohabitation',
  'College',
  'Coming of Age',
  'Conspiracy',
  'Cosmic Horror',
  'Cosplay',
  'Cowboys',
  'Creature Taming',
  'Crime',
  'Criminal Organization',
  'Crossdressing',
  'Crossover',
  'Cult',
  'Cultivation',
  'Curses',
  'Cute Boys Doing Cute Things',
  'Cute Girls Doing Cute Things',
  'Cyberpunk',
  'Cyborg',
  'Cycling',
  'Dancing',
  'Death Game',
  'Delinquents',
  'Demons',
  'Denpa',
  'Desert',
  'Detective',
  'Dinosaurs',
  'Disability',
  'Dissociative Identities',
  'Dragons',
  'Drawing',
  'Drugs',
  'Dullahan',
  'Dungeon',
  'Dystopian',
  'E-Sports',
  'Eco-Horror',
  'Economics',
  'Educational',
  'Elderly Protagonist',
  'Elf',
  'Ensemble Cast',
  'Environmental',
  'Episodic',
  'Ero Guro',
  'Espionage',
  'Estranged Family',
  'Exorcism',
  'Fairy',
  'Fairy Tale',
  'Fake Relationship',
  'Family Life',
  'Fashion',
  'Female Harem',
  'Female Protagonist',
  'Femboy',
  'Fencing',
  'Filmmaking',
  'Firefighters',
  'Fishing',
  'Fitness',
  'Flash',
  'Food',
  'Football',
  'Foreign',
  'Found Family',
  'Fugitive',
  'Full CGI',
  'Full Color',
  'Gambling',
  'Gangs',
  'Gender Bending',
  'Ghost',
  'Go',
  'Goblin',
  'Gods',
  'Golf',
  'Gore',
  'Guns',
  'Gyaru',
  'Handball',
  'Henshin',
  'Heterosexual',
  'Hikikomori',
  'Hip-hop Music',
  'Historical',
  'Homeless',
  'Horticulture',
  'Ice Skating',
  'Idol',
  'Indigenous Cultures',
  'Inn',
  'Isekai',
  'Iyashikei',
  'Jazz Music',
  'Josei',
  'Judo',
  'Kabuki',
  'Kaiju',
  'Karuta',
  'Kemonomimi',
  'Kids',
  'Kingdom Management',
  'Konbini',
  'Kuudere',
  'Lacrosse',
  'Language Barrier',
  'LGBTQ+ Themes',
  'Long Strip',
  'Lost Civilization',
  'Love Triangle',
  'Mafia',
  'Magic',
  'Mahjong',
  'Maids',
  'Makeup',
  'Male Harem',
  'Male Protagonist',
  'Manzai',
  'Marriage',
  'Martial Arts',
  'Matchmaking',
  'Matriarchy',
  'Medicine',
  'Medieval',
  'Memory Manipulation',
  'Mermaid',
  'Meta',
  'Metal Music',
  'Military',
  'Mixed Gender Harem',
  'Mixed Media',
  'Modeling',
  'Monster Boy',
  'Monster Girl',
  'Mopeds',
  'Motorcycles',
  'Mountaineering',
  'Musical Theater',
  'Mythology',
  'Natural Disaster',
  'Necromancy',
  'Nekomimi',
  'Ninja',
  'No Dialogue',
  'Noir',
  'Non-fiction',
  'Nudity',
  'Nun',
  'Office',
  'Office Lady',
  'Oiran',
  'Ojou-sama',
  'Orphan',
  'Otaku Culture',
  'Outdoor Activities',
  'Pandemic',
  'Parenthood',
  'Parkour',
  'Parody',
  'Philosophy',
  'Photography',
  'Pirates',
  'Poker',
  'Police',
  'Politics',
  'Polyamorous',
  'Post-Apocalyptic',
  'POV',
  'Pregnancy',
  'Primarily Adult Cast',
  'Primarily Animal Cast',
  'Primarily Child Cast',
  'Primarily Female Cast',
  'Primarily Male Cast',
  'Primarily Teen Cast',
  'Prison',
  'Proxy Battle',
  'Psychosexual',
  'Puppetry',
  'Rakugo',
  'Real Robot',
  'Rehabilitation',
  'Reincarnation',
  'Religion',
  'Rescue',
  'Restaurant',
  'Revenge',
  'Reverse Isekai',
  'Robots',
  'Rock Music',
  'Rotoscoping',
  'Royal Affairs',
  'Rugby',
  'Rural',
  'Samurai',
  'Satire',
  'School',
  'School Club',
  'Scuba Diving',
  'Seinen',
  'Shapeshifting',
  'Ships',
  'Shogi',
  'Shoujo',
  'Shounen',
  'Shrine Maiden',
  'Skateboarding',
  'Skeleton',
  'Slapstick',
  'Slavery',
  'Snowscape',
  'Software Development',
  'Space',
  'Space Opera',
  'Spearplay',
  'Steampunk',
  'Stop Motion',
  'Succubus',
  'Suicide',
  'Sumo',
  'Super Power',
  'Super Robot',
  'Superhero',
  'Surfing',
  'Surreal Comedy',
  'Survival',
  'Swimming',
  'Swordplay',
  'Table Tennis',
  'Tanks',
  'Tanned Skin',
  'Teacher',
  'Teens\' Love',
  'Tennis',
  'Terrorism',
  'Time Loop',
  'Time Manipulation',
  'Time Skip',
  'Tokusatsu',
  'Tomboy',
  'Torture',
  'Tragedy',
  'Trains',
  'Transgender',
  'Travel',
  'Triads',
  'Tsundere',
  'Twins',
  'Unrequited Love',
  'Urban',
  'Urban Fantasy',
  'Vampire',
  'Vertical Video',
  'Veterinarian',
  'Video Games',
  'Vikings',
  'Villainess',
  'Virtual World',
  'Vocal Synth',
  'Volleyball',
  'VTuber',
  'War',
  'Werewolf',
  'Wilderness',
  'Witch',
  'Work',
  'Wrestling',
  'Writing',
  'Wuxia',
  'Yakuza',
  'Yandere',
  'Youkai',
  'Yuri',
  'Zombie'
].map(tag => ({
  value: tag,
  label: tag
}))
