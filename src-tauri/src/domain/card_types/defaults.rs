//! Default card types created with a world, by genre (validated by Clément
//! on 2026-09-27, see docs/features/01-cartes-et-types.md). Names and
//! templates are world data: they are written in the app language of the
//! moment and can then be edited like any other type.

use crate::settings::Language;
use crate::world::Genre;

/// A text in the two app languages.
#[derive(Debug, Clone, Copy)]
pub struct Text {
    pub fr: &'static str,
    pub en: &'static str,
}

impl Text {
    pub fn get(self, language: Language) -> &'static str {
        match language {
            Language::Fr => self.fr,
            Language::En => self.en,
        }
    }
}

const fn t(fr: &'static str, en: &'static str) -> Text {
    Text { fr, en }
}

/// A section of a guided template: a title and a question to help write it.
#[derive(Debug, Clone, Copy)]
pub struct Section {
    pub title: Text,
    pub prompt: Text,
}

const fn s(title: Text, prompt: Text) -> Section {
    Section { title, prompt }
}

#[derive(Debug, Clone, Copy)]
pub struct DefaultType {
    pub name: Text,
    pub icon: &'static str,
    pub color: &'static str,
    pub template: &'static [Section],
}

const CHARACTER: DefaultType = DefaultType {
    name: t("Personnage", "Character"),
    icon: "user",
    color: "blue",
    template: &[
        s(
            t("Background", "Background"),
            t(
                "D'où vient ce personnage, qu'a-t-il vécu ?",
                "Where does this character come from, what have they lived through?",
            ),
        ),
        s(
            t("Personnalité", "Personality"),
            t(
                "Qu'est-ce qui le fait agir, qu'est-ce qu'il craint ?",
                "What drives them, what do they fear?",
            ),
        ),
        s(
            t("Apparence", "Appearance"),
            t(
                "À quoi ressemble-t-il au premier regard ?",
                "What do they look like at first glance?",
            ),
        ),
    ],
};

/// Location: its subtypes depend on the genre (see `location_subtypes`).
const LOCATION: DefaultType = DefaultType {
    name: t("Lieu", "Location"),
    icon: "map-pin",
    color: "green",
    template: &[
        s(
            t("Géographie", "Geography"),
            t(
                "Où se trouve ce lieu, à quoi ressemble-t-il ?",
                "Where is this place, what does it look like?",
            ),
        ),
        s(
            t("Histoire", "History"),
            t("Que s'est-il passé ici ?", "What happened here?"),
        ),
        s(
            t("Habitants", "Inhabitants"),
            t(
                "Qui vit ou passe ici ?",
                "Who lives here or passes through?",
            ),
        ),
    ],
};

const ITEM: DefaultType = DefaultType {
    name: t("Objet", "Item"),
    icon: "gem",
    color: "amber",
    template: &[
        s(
            t("Description", "Description"),
            t(
                "À quoi ressemble cet objet ?",
                "What does this item look like?",
            ),
        ),
        s(
            t("Origine", "Origin"),
            t("Qui l'a créé, et pourquoi ?", "Who made it, and why?"),
        ),
        s(
            t("Usages", "Uses"),
            t(
                "À quoi sert-il, quels pouvoirs a-t-il ?",
                "What is it for, what powers does it have?",
            ),
        ),
    ],
};

const EVENT: DefaultType = DefaultType {
    name: t("Événement", "Event"),
    icon: "calendar",
    color: "orange",
    template: &[
        s(
            t("Contexte", "Context"),
            t(
                "Qu'est-ce qui a mené à cet événement ?",
                "What led to this event?",
            ),
        ),
        s(
            t("Déroulement", "Course"),
            t("Comment s'est-il passé ?", "How did it unfold?"),
        ),
        s(
            t("Conséquences", "Consequences"),
            t("Qu'a-t-il changé ?", "What did it change?"),
        ),
    ],
};

const FACTION: DefaultType = DefaultType {
    name: t("Faction", "Faction"),
    icon: "shield",
    color: "red",
    template: &[
        s(
            t("Objectifs", "Goals"),
            t("Que veut cette faction ?", "What does this faction want?"),
        ),
        s(
            t("Membres", "Members"),
            t(
                "Qui la compose, qui la dirige ?",
                "Who are its members, who leads it?",
            ),
        ),
        s(
            t("Histoire", "History"),
            t("Comment est-elle née ?", "How did it come to be?"),
        ),
    ],
};

const LORE: DefaultType = DefaultType {
    name: t("Lore", "Lore"),
    icon: "book-open",
    color: "violet",
    template: &[
        s(
            t("Résumé", "Summary"),
            t("Que faut-il en retenir ?", "What should be remembered?"),
        ),
        s(
            t("Détails", "Details"),
            t("Qu'est-ce qui le rend unique ?", "What makes it unique?"),
        ),
    ],
};

const NOTE: DefaultType = DefaultType {
    name: t("Note", "Note"),
    icon: "sticky-note",
    color: "slate",
    template: &[],
};

const MAGIC_SYSTEM: DefaultType = DefaultType {
    name: t("Système de magie", "Magic system"),
    icon: "sparkles",
    color: "violet",
    template: &[
        s(
            t("Fonctionnement", "How it works"),
            t(
                "D'où vient la magie, comment s'utilise-t-elle ?",
                "Where does magic come from, how is it used?",
            ),
        ),
        s(
            t("Limites", "Limits"),
            t("Que ne peut-elle pas faire ?", "What can it not do?"),
        ),
        s(
            t("Coût", "Cost"),
            t(
                "Que coûte-t-elle à qui l'utilise ?",
                "What does it cost those who use it?",
            ),
        ),
    ],
};

const RELIGION: DefaultType = DefaultType {
    name: t("Religion", "Religion"),
    icon: "church",
    color: "amber",
    template: &[
        s(
            t("Croyances", "Beliefs"),
            t(
                "En quoi ses fidèles croient-ils ?",
                "What do its followers believe?",
            ),
        ),
        s(
            t("Rites", "Rites"),
            t(
                "Quelles pratiques, quelles fêtes ?",
                "Which practices, which celebrations?",
            ),
        ),
        s(
            t("Clergé", "Clergy"),
            t(
                "Qui la sert, qui la dirige ?",
                "Who serves it, who leads it?",
            ),
        ),
    ],
};

const RACE: DefaultType = DefaultType {
    name: t("Race", "Race"),
    icon: "users",
    color: "teal",
    template: &[
        s(
            t("Apparence", "Appearance"),
            t(
                "À quoi ressemblent ses membres ?",
                "What do its members look like?",
            ),
        ),
        s(
            t("Culture", "Culture"),
            t(
                "Quelles coutumes, quelles valeurs ?",
                "Which customs, which values?",
            ),
        ),
        s(
            t("Histoire", "History"),
            t("D'où vient ce peuple ?", "Where do these people come from?"),
        ),
    ],
};

const CREATURE: DefaultType = DefaultType {
    name: t("Créature", "Creature"),
    icon: "paw-print",
    color: "green",
    template: &[
        s(
            t("Apparence", "Appearance"),
            t("À quoi ressemble-t-elle ?", "What does it look like?"),
        ),
        s(
            t("Comportement", "Behavior"),
            t(
                "Comment vit-elle, est-elle dangereuse ?",
                "How does it live, is it dangerous?",
            ),
        ),
        s(
            t("Habitat", "Habitat"),
            t("Où la trouve-t-on ?", "Where can it be found?"),
        ),
    ],
};

const ECOLOGY: DefaultType = DefaultType {
    name: t("Écologie", "Ecology"),
    icon: "leaf",
    color: "green",
    template: &[
        s(
            t("Climat", "Climate"),
            t(
                "Quel temps fait-il, selon les saisons ?",
                "What is the weather, season by season?",
            ),
        ),
        s(
            t("Faune et flore", "Fauna and flora"),
            t("Qu'est-ce qui vit ici ?", "What lives here?"),
        ),
    ],
};

const TECHNOLOGY: DefaultType = DefaultType {
    name: t("Technologie", "Technology"),
    icon: "cpu",
    color: "blue",
    template: &[
        s(
            t("Fonctionnement", "How it works"),
            t("Comment fonctionne-t-elle ?", "How does it work?"),
        ),
        s(
            t("Usages", "Uses"),
            t(
                "Qui s'en sert, et pour quoi ?",
                "Who uses it, and for what?",
            ),
        ),
        s(
            t("Limites", "Limits"),
            t(
                "Quels sont ses défauts et ses risques ?",
                "What are its flaws and risks?",
            ),
        ),
    ],
};

const SHIP: DefaultType = DefaultType {
    name: t("Vaisseau", "Ship"),
    icon: "rocket",
    color: "slate",
    template: &[
        s(
            t("Caractéristiques", "Specifications"),
            t("Taille, vitesse, armement ?", "Size, speed, weapons?"),
        ),
        s(
            t("Équipage", "Crew"),
            t("Qui est à bord ?", "Who is on board?"),
        ),
        s(
            t("Histoire", "History"),
            t(
                "Quelles missions a-t-il connues ?",
                "Which missions has it been on?",
            ),
        ),
    ],
};

const SPECIES: DefaultType = DefaultType {
    name: t("Espèce", "Species"),
    icon: "dna",
    color: "teal",
    template: &[
        s(
            t("Biologie", "Biology"),
            t(
                "Comment cette espèce vit-elle ?",
                "How does this species live?",
            ),
        ),
        s(
            t("Culture", "Culture"),
            t(
                "Quelle société a-t-elle bâtie ?",
                "What society has it built?",
            ),
        ),
        s(
            t("Histoire", "History"),
            t("D'où vient-elle ?", "Where does it come from?"),
        ),
    ],
};

const PLANET: DefaultType = DefaultType {
    name: t("Planète", "Planet"),
    icon: "globe",
    color: "orange",
    template: &[
        s(
            t("Géographie", "Geography"),
            t(
                "Quels continents, quels océans ?",
                "Which continents, which oceans?",
            ),
        ),
        s(
            t("Climat", "Climate"),
            t("Est-elle habitable, et où ?", "Is it habitable, and where?"),
        ),
        s(
            t("Peuples", "Peoples"),
            t("Qui y vit ?", "Who lives there?"),
        ),
    ],
};

const CORPORATION: DefaultType = DefaultType {
    name: t("Corporation", "Corporation"),
    icon: "building-2",
    color: "red",
    template: &[
        s(
            t("Activités", "Business"),
            t(
                "Que vend-elle, que contrôle-t-elle ?",
                "What does it sell, what does it control?",
            ),
        ),
        s(
            t("Dirigeants", "Leaders"),
            t("Qui la dirige ?", "Who runs it?"),
        ),
        s(
            t("Secrets", "Secrets"),
            t("Que cache-t-elle ?", "What does it hide?"),
        ),
    ],
};

const IMPLANT: DefaultType = DefaultType {
    name: t("Implant", "Implant"),
    icon: "circuit-board",
    color: "pink",
    template: &[
        s(
            t("Fonction", "Function"),
            t("Que permet cet implant ?", "What does this implant do?"),
        ),
        s(
            t("Effets secondaires", "Side effects"),
            t("Qu'en coûte-t-il au corps ?", "What does it cost the body?"),
        ),
    ],
};

const RELATIONSHIP: DefaultType = DefaultType {
    name: t("Relation", "Relationship"),
    icon: "heart",
    color: "pink",
    template: &[
        s(
            t("Rencontre", "Meeting"),
            t("Comment se sont-ils rencontrés ?", "How did they meet?"),
        ),
        s(
            t("Évolution", "Evolution"),
            t(
                "Comment leur lien a-t-il changé ?",
                "How has their bond changed?",
            ),
        ),
        s(
            t("Obstacles", "Obstacles"),
            t("Qu'est-ce qui les sépare ?", "What keeps them apart?"),
        ),
    ],
};

const MEETING_PLACE: DefaultType = DefaultType {
    name: t("Lieu de rencontre", "Meeting place"),
    icon: "coffee",
    color: "amber",
    template: &[
        s(
            t("Ambiance", "Atmosphere"),
            t(
                "Qu'est-ce qui rend ce lieu particulier ?",
                "What makes this place special?",
            ),
        ),
        s(
            t("Souvenirs", "Memories"),
            t("Que s'y est-il passé ?", "What happened here?"),
        ),
    ],
};

const ORGANIZATION: DefaultType = DefaultType {
    name: t("Organisation", "Organization"),
    icon: "building",
    color: "slate",
    template: &[
        s(
            t("Mission", "Mission"),
            t(
                "À quoi sert cette organisation ?",
                "What is this organization for?",
            ),
        ),
        s(
            t("Membres", "Members"),
            t("Qui en fait partie ?", "Who belongs to it?"),
        ),
        s(
            t("Histoire", "History"),
            t("Comment est-elle née ?", "How did it come to be?"),
        ),
    ],
};

/// Types of every world, in order. `LOCATION` is second.
const COMMON: [DefaultType; 7] = [CHARACTER, LOCATION, ITEM, EVENT, FACTION, LORE, NOTE];

/// Types added for a genre, after the common ones.
fn genre_types(genre: Genre) -> &'static [DefaultType] {
    match genre {
        Genre::Fantasy => &[MAGIC_SYSTEM, RELIGION, RACE, CREATURE, ECOLOGY],
        Genre::ScienceFiction => &[TECHNOLOGY, SHIP, SPECIES, PLANET],
        Genre::Cyberpunk => &[TECHNOLOGY, CORPORATION, IMPLANT],
        Genre::Romance => &[RELATIONSHIP, MEETING_PLACE],
        Genre::Contemporary => &[ORGANIZATION, RELATIONSHIP],
        Genre::Other => &[],
    }
}

/// Whether `default` is the Location type, whose subtypes depend on the genre.
pub fn is_location(default: &DefaultType) -> bool {
    default.name.en == LOCATION.name.en
}

/// Subtypes of the Location type for a genre.
pub fn location_subtypes(genre: Genre) -> &'static [Text] {
    match genre {
        Genre::Fantasy => &[
            Text {
                fr: "Royaume",
                en: "Kingdom",
            },
            Text {
                fr: "Ville",
                en: "City",
            },
            Text {
                fr: "Hameau",
                en: "Hamlet",
            },
            Text {
                fr: "Donjon",
                en: "Dungeon",
            },
            Text {
                fr: "Point de repère",
                en: "Landmark",
            },
        ],
        Genre::ScienceFiction => &[
            Text {
                fr: "Système stellaire",
                en: "Star system",
            },
            Text {
                fr: "Station",
                en: "Station",
            },
            Text {
                fr: "Colonie",
                en: "Colony",
            },
            Text {
                fr: "Base",
                en: "Base",
            },
        ],
        Genre::Cyberpunk => &[
            Text {
                fr: "Mégalopole",
                en: "Megacity",
            },
            Text {
                fr: "Quartier",
                en: "District",
            },
            Text {
                fr: "Planque",
                en: "Hideout",
            },
            Text {
                fr: "Réseau",
                en: "Network",
            },
        ],
        Genre::Romance => &[
            Text {
                fr: "Ville",
                en: "City",
            },
            Text {
                fr: "Maison",
                en: "House",
            },
            Text {
                fr: "Lieu de rencontre",
                en: "Meeting place",
            },
        ],
        Genre::Contemporary => &[
            Text {
                fr: "Pays",
                en: "Country",
            },
            Text {
                fr: "Ville",
                en: "City",
            },
            Text {
                fr: "Quartier",
                en: "District",
            },
            Text {
                fr: "Bâtiment",
                en: "Building",
            },
        ],
        Genre::Other => &[
            Text {
                fr: "Région",
                en: "Region",
            },
            Text {
                fr: "Ville",
                en: "City",
            },
            Text {
                fr: "Bâtiment",
                en: "Building",
            },
        ],
    }
}

/// Default types of a world of `genre`, in order.
pub fn types_for(genre: Genre) -> Vec<DefaultType> {
    COMMON.iter().chain(genre_types(genre)).copied().collect()
}
