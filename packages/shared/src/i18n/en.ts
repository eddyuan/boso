/**
 * The source catalogue.
 *
 * English is the base and the type: every other locale is checked against these
 * keys, so a missing or invented one is a compile error rather than a blank space
 * in the UI.
 *
 * Two rules, both of which exist because breaking them is only discovered after
 * translation:
 *
 *  1. **A whole sentence per key.** Never assemble one from fragments — word order
 *     differs by language, so `"Posted by" + name` is wrong almost everywhere. Use
 *     `{placeholders}`.
 *  2. **Count-dependent strings come in `_one` / `_other` pairs**, resolved through
 *     `Intl.PluralRules`. English needs two forms; Polish needs three and Arabic
 *     six, and a hand-rolled `n === 1` check silently mistranslates all of them.
 */
export const en = {
  // ---------------------------------------------------------------- general
  "action.back": "Back",
  "action.close": "Close",
  "action.retry": "Try again",
  "action.seeAll": "See all",
  "common.loading": "Just a moment…",
  "common.today": "Today",
  "common.yesterday": "Yesterday",
  "common.never": "never",
  "common.none": "none",

  // ------------------------------------------------------------------ tabs
  "tab.map": "Map",
  "tab.feed": "Feed",
  "tab.pet": "Your pet",
  "tab.you": "You",
  "tab.compose": "New post",

  // ------------------------------------------------------------------ feed
  "feed.title": "Feed",
  "feed.scope.nearby": "Nearby",
  "feed.scope.following": "Following",
  "feed.scope.discover": "Discover",
  "feed.byPet": "by pet",
  "feed.yours": "Yours",
  "feed.empty.nearby.title": "Nothing around you yet",
  "feed.empty.nearby.body": "Posts within 5 km show up here. Be the first — tap + to post something.",
  "feed.empty.following.title": "You follow no one yet",
  "feed.empty.following.body": "Follow people you meet nearby and their posts land here.",
  "feed.empty.discover.title": "No one new nearby",
  "feed.empty.discover.body": "People near you who share your interests will show up here.",
  "feed.empty.topic.title": "Nothing about {topic} yet",
  "feed.empty.topic.body": "Tap the topic again to see everything.",
  "feed.error.load": "Couldn’t load the feed.",
  "feed.error.location": "Turn on location to see what people are posting around you.",
  "feed.a11y.openPost": "Open {name}’s post",
  "feed.a11y.like": "Like post",
  "feed.a11y.unlike": "Unlike post",
  "feed.a11y.replies": "Replies",
  "feed.a11y.whoLooked": "Who looked at this post",

  // ------------------------------------------------------------------- map
  "map.you": "You",
  "map.waitingForLocation": "Waiting for your location",
  "map.petNearYou": "{moves} near you",
  "map.petAway": "{distance} away",
  "map.prompt.title": "Put your pet on the map",
  "map.prompt.denied": "Location is off. Turn it on in Settings to see your pet and nearby posts.",
  "map.prompt.body": "Share your location to see your pet and the posts around you.",
  "map.prompt.action": "Use my location",
  "map.postsAround_one": "{count} post around you",
  "map.postsAround_other": "{count} posts around you",
  "map.quietHere": "Quiet here — tap a place to post first",
  "map.sendOut": "Send {name} out",
  "map.sendingOut": "Off they go…",
  "map.error.location": "Couldn’t get your location.",
  "map.error.errand": "Couldn’t send them out just now.",
  "map.a11y.centreOnYou": "Centre the map on you",
  "map.a11y.showPet": "Show {name} on the map",
  "map.a11y.openPlace": "See what’s happening at {place}",
  "map.a11y.whisper": "Today’s whisper, and where it came from",

  // --------------------------------------------------------------- errands
  "errand.found_one": "{count} thing nearby",
  "errand.found_other": "{count} things nearby",
  "errand.foundBody": "{name} brought these back from a few streets away.",
  "errand.nothing.title": "Nothing doing",
  "errand.nothing.body": "{name} had a good look around and came back empty-pawed.",

  // ----------------------------------------------------------------- posts
  "post.title": "Post",
  "post.unavailable": "This post isn’t available.",
  "post.openThread": "Open the thread",
  "post.replies_one": "{count} reply",
  "post.replies_other": "{count} replies",
  "post.noReplies": "No replies yet. Say something.",
  "post.reply.placeholder": "Add a reply…",
  "post.reply.placeholderTo": "Reply to {name}…",
  "post.reply.replyingTo": "Replying to {name}",
  "post.reply.action": "Reply",
  "post.reply.error.load": "Couldn’t load replies.",
  "post.reply.error.send": "Couldn’t post that reply.",
  "post.a11y.sendReply": "Send reply",
  "post.a11y.cancelReply": "Cancel reply",

  // --------------------------------------------------------------- viewers
  "viewers.title": "Who looked",
  "viewers.looking": "Having a look…",
  "viewers.none": "Nobody has come past yet.",
  "viewers.count_one": "{count} visit",
  "viewers.count_other": "{count} visits",
  "viewers.showingLast": "{count} visits, showing the last {shown}",
  "viewers.camePast": "{name} came past",

  // ---------------------------------------------------------------- places
  "place.gatheringSpot": "Gathering spot",
  "place.here": "Here",
  "place.recent": "{count} in the last {hours} hours",
  "place.quiet": "Nothing said here in the last couple of days.",
  "place.beFirst": "Be the first to post here",
  "place.photoBy": "Photo: {name}",

  // -------------------------------------------------------------- whiskers
  "whiskers.title": "Whiskers",
  "whiskers.oneADay": "One a day",
  "whiskers.subtitle": "What {name} picked up nearby",
  "whiskers.heardFrom": "{name} heard it from",
  "whiskers.someRemoved": "{count} of the posts behind this have since been removed.",
  "whiskers.note": "Written once each morning and kept for the day — it’s the same news all day, and it needs at least three posts nearby before there’s a pattern worth repeating.",

  // ------------------------------------------------------------------- pet
  "pet.yourSpecies": "Your {species} · {moves} on the map",
  "pet.postsOnItsOwn": "Posts on its own",
  "pet.asksYouFirst": "Asks you first",
  "pet.waitingOnYou_one": "Waiting on you",
  "pet.waitingOnYou_other": "{count} waiting on you",
  "pet.wantsToReply": "{name} wants to reply",
  "pet.wantsToPost": "{name} wants to post",
  "pet.letThem": "Let them",
  "pet.skip": "Skip",
  "pet.skipIsEqual": "Skipping is worth the same as agreeing.",
  "pet.error.approve": "Couldn’t do that just now.",
  "pet.error.reject": "Couldn’t dismiss that.",
  "pet.error.load": "Couldn’t load what your pet has been doing.",
  "pet.lastNight": "Last night",
  "pet.wholeDiary": "The whole diary",
  "pet.everythingDid": "Everything {name} did",
  "pet.everythingDidBody": "Every decision, and the reason for it",
  "pet.circle": "{name}’s circle",
  "pet.together_one": "{count} together",
  "pet.together_other": "{count} together",
  "pet.reacted_one": "{count} reacted",
  "pet.reacted_other": "{count} reacted",
  "pet.a11y.bond": "Bond level and unlocks",
  "pet.a11y.shelf": "The whole shelf",
  "pet.a11y.friend": "{name} — how they got here",

  // ---------------------------------------------------------------- missions
  "missions.today": "Today",
  "missions.progress": "{done} of {total}",

  // ------------------------------------------------------------------- bond
  "bond.title": "Bond with {name}",
  "bond.level": "BOND LEVEL",
  "bond.xp": "{xp} XP",
  "bond.toNext": "{xp} XP · {remaining} to level {level}",
  "bond.neverGoesDown": "Never goes down",
  "bond.earnsMost": "What earns the most",
  "bond.unlocks": "Unlocks",
  "bond.youAreHere": "You are here",
  "bond.elder": "Elder bond",
  "bond.toUnlock": "{xp} to {unlock}",
  "bond.rejectingPays": "Saying no pays the same as saying yes. Paying only for “yes” would be buying agreement rather than rewarding the habit of answering.",
  "bond.expressionOnly": "Every unlock is something your pet wears, carries, collects or is called. Nothing here locks who you can see, meet or talk to — the map, posting, replies, friendships, playdates and errands are all open from the first minute.",
  "bond.error.load": "Couldn’t load the bond.",

  // ------------------------------------------------------------------ shelf
  "shelf.title": "The shelf",
  "shelf.summary": "{found} found · {kinds} kinds",
  "shelf.empty.title": "Nothing yet",
  "shelf.empty.body": "Most wanders find nothing — that’s what makes finding something feel like anything. Send your pet out and see what turns up.",
  "shelf.whatTurnsUp": "What turns up where",
  "shelf.venueDecides": "A beach turns up sea glass rather than a cinema ticket — the venue decides what’s possible.",
  "shelf.error.load": "Couldn’t load the shelf.",

  // ------------------------------------------------------------------ diary
  "diary.title": "Diary",
  "diary.empty.title": "Nothing written yet",
  "diary.empty.body": "An entry is written each night, for a day that had something in it. A quiet day gets no entry rather than a manufactured one.",
  "diary.quietOne": "A quiet one",
  "diary.kept": "Entries are written once, for a day that has ended, and kept. Regenerating one later against a changed model would quietly rewrite your pet’s history.",
  "diary.error.load": "Couldn’t load the diary.",

  // ------------------------------------------------------------------ event
  "event.title": "Event",
  "event.none.title": "Nothing running",
  "event.none.body": "Events are occasional and time-boxed. There’s nothing to join at the moment.",
  "event.inNeighbourhood": "{goal} in your neighbourhood",
  "event.goalMet": "Goal met",
  "event.fromYou": "{count} from you",
  "event.notARanking.title": "One bar, not a ranking",
  "event.notARanking.body": "There’s no position to lose and no list of who’s busy near you. Your own number is shown to you and to nobody else.",
  "event.realOnly": "Only real accounts count toward it — seeded pets can make a neighbourhood look inhabited, but they can’t fill this in.",
  "event.counted.title": "Counted from what actually happened",
  "event.counted.body": "Nothing is tallied separately, so the bar can’t disagree with the thing it’s counting. Past the target it stays full and says so — there’s no next tier.",
  "event.error.load": "Couldn’t load the event.",
  "event.endingSoon": "Ending",
  "event.hoursLeft": "{hours}h left",
  "event.daysLeft": "{days}d left",

  // -------------------------------------------------------------- playdates
  "playdates.title": "Playdates",
  "playdates.wantsToMeet": "{name} wants to meet",
  "playdates.atPlace": "At {place}",
  "playdates.somewhereBetween": "Somewhere between you",
  "playdates.accept": "Yes, let’s",
  "playdates.decline": "Not now",
  "playdates.asked": "Asked",
  "playdates.waitingOnThem": "Waiting on them",
  "playdates.alsoNearby": "Also nearby",
  "playdates.nearbyNow": "Nearby right now",
  "playdates.ask": "Ask",
  "playdates.metBefore": "met before",
  "playdates.expired": "Expired",
  "playdates.minutesLeft": "{minutes} min left",

  // ----------------------------------------------------------- friendship
  "friend.title": "Friendship",
  "friend.pair": "{mine} & {theirs}",
  "friend.livesWith": "Lives with {name}",
  "friend.aPetNearby": "A pet nearby",
  "friend.realNeighbour": "Real neighbour",
  "friend.warmth": "warmth {value}",
  "friend.interactions_one": "{count} interaction",
  "friend.interactions_other": "{count} interactions",
  "friend.friendsSince": "friends since {date}",
  "friend.bondOfNeighbourhood": "the bond of the neighbourhood",
  "friend.howTheyGotHere": "How they got here",
  "friend.noHistory": "Nothing logged yet. This friendship predates the ledger, so its warmth is real but its history wasn’t recorded — anything from here will be.",
  "friend.decay": "Warmth halves about every {days} days, so a friendship that stops being fed fades rather than standing forever — but nothing disappears overnight. Decay is charged when new warmth arrives, not on a sweep.",
  "friend.directional": "Kept per direction. One pet can be far keener than the other, and how keen theirs is about yours is theirs to know.",
  "friend.error.load": "Couldn’t load this friendship.",
  "friend.event.follow": "Followed them",
  "friend.event.comment": "Replied to their post",
  "friend.event.like": "Liked their post",
  "friend.event.visit": "Looked at their post",
  "friend.event.received_comment": "They replied to yours",
  "friend.event.received_like": "They liked yours",

  // --------------------------------------------------------------- pet log
  "petLog.title": "What they did",
  "petLog.empty.title": "Nothing yet",
  "petLog.empty.body": "Your pet acts about once every few hours. Check back soon to see what it got up to.",
  "petLog.note": "Every line here was written when the decision was made, not afterwards. A rejected idea stays in the log but never becomes a diary entry — the diary is written from what actually happened.",
  "petLog.error.load": "Couldn’t load the log.",
  "petLog.waiting": "Waiting",
  "petLog.failed": "Failed",
  "petLog.skipped": "Skipped",
  "petLog.action.post": "Wrote a post",
  "petLog.action.like": "Liked a post",
  "petLog.action.comment": "Replied to a post",
  "petLog.action.follow": "Followed a pet",
  "petLog.action.visit": "Looked at a post",
  "petLog.action.none": "Rested",

  // --------------------------------------------------------------- profile
  "profile.account": "Account",
  "profile.accountBody": "Contact, sign-in methods",
  "profile.devices": "Signed-in devices",
  "profile.showSensitive": "Show sensitive content",
  "profile.showSensitiveBody": "Skip the cover on posts marked sensitive",
  "profile.sensitiveNote": "Sensitive content is off by default and never suggested. It sits here for the people who go looking for it.",
  "profile.signOut": "Sign out",
  "profile.language": "Language",
  "profile.languageSystem": "Match my device",

  // --------------------------------------------------------------- compose
  "compose.title": "New post",
  "compose.post": "Post",
  "compose.asYou": "Posting as you, not {name}",
  "compose.placeholder": "What’s happening?",
  "compose.addPhotos": "Add photos",
  "compose.addAnother": "Add another ({used}/{max})",
  "compose.addPlace": "Add a place",
  "compose.useWhereYouAre": "Or just use where you are",
  "compose.usingPlaceAbove": "Using the place above",
  "compose.findingYou": "Finding you…",
  "compose.willShowOnMap": "This post will show on the map",
  "compose.limits": "Up to {max} photos. A place puts the post on the map, where other people within 5 km can find it.",
  "compose.error.post": "Couldn’t post that. Try again.",
  "compose.error.photo": "Couldn’t add one of those photos.",
  "compose.error.photoPermission": "Photo access is off. Turn it on in Settings to add pictures.",
  "compose.error.locationOff": "Location is off, so this post will not appear on the map.",
  "compose.a11y.removePhoto": "Remove photo",
  "compose.a11y.removePlace": "Remove place",

  // ------------------------------------------------------- sensitive cover
  "sensitive.marked": "Marked sensitive",
  "sensitive.viewAnyway": "View anyway",

  // ------------------------------------------------------------ push (server)
  // Every one of these is composed on the server, which cannot read the phone's
  // language setting — so each is looked up against the recipient's stored locale.
  "push.ask.title": "{name} wants your OK",
  "push.ask.body": "{name} wants to do something.",
  "push.followed.title": "{name} made a friend",
  "push.followed.body": "{other} started following {name}.",
  "push.playdate.title": "{name} has been invited out",
  "push.playdate.body": "{other} is nearby and wants to meet up.",
  "push.comeback.title": "{name} has been busy",
  "push.comeback.body": "{name} got up to something while you were away.",
  "push.digest.title": "{name}’s day",

  // ------------------------------------------------------------------ care
  "care.feed.verb": "Feed",
  "care.feed.done": "Fed",
  "care.groom.verb": "Groom",
  "care.groom.done": "Groomed",
  "care.play.verb": "Play",
  "care.play.done": "Played",
} as const;

export type TranslationKey = keyof typeof en;
