#!/usr/bin/env python3
"""Pull men's college basketball games from the ESPN scoreboard API and write
Scheduling Board `games` documents (one JSON file per game) for ArtifactData.

Usage: board_cbb_refresh.py START END OUT_DIR   (dates as YYYYMMDD, inclusive)

Only games on a national channel that maps to a test app are kept, so the board
is not flooded with ESPN+ / regional games. Doc ids are "cbb<espnEventId>".
"""
import json, os, sys, urllib.request
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

API = ("https://site.api.espn.com/apis/site/v2/sports/basketball/"
       "mens-college-basketball/scoreboard?dates={d}&groups=50&limit=500")
ET = ZoneInfo("America/New_York")

# ESPN broadcast name -> text the board's NET_TOKENS understands (app appended
# where the board would not infer it from carriage)
NETS = {
    "CBS": "CBS / Paramount+",
    "TNT": "TNT / HBO Max", "truTV": "truTV / HBO Max", "TBS": "TBS / HBO Max",
    "Peacock": "Peacock", "NBC": "NBC / Peacock", "NBCSN": "NBCSN / Peacock",
    "FOX": "FOX", "FS1": "FS1",
    "ESPN": "ESPN", "ESPN2": "ESPN", "ESPNU": "ESPN", "ABC": "ABC",
}


def fetch(day):
    req = urllib.request.Request(API.format(d=day.strftime("%Y%m%d")),
                                 headers={"User-Agent": "vqoe-board/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r).get("events", [])


def to_doc(ev, pulled):
    comp = ev["competitions"][0]
    names = [n for b in comp.get("broadcasts", []) for n in b.get("names", [])]
    tv = []
    for n in names:
        if n in NETS and NETS[n] not in tv:
            tv.append(NETS[n])
    if not tv:
        return None
    teams = {c["homeAway"]: c["team"]["displayName"] for c in comp["competitors"]}
    start = datetime.fromisoformat(ev["date"].replace("Z", "+00:00"))
    local = start.astimezone(ET)
    tbd = bool(comp.get("timeValid") is False)
    status = ev.get("status", {}).get("type", {})
    notes = [n.get("headline") for n in comp.get("notes", []) if n.get("headline")]
    conf = comp.get("conferenceCompetition")
    venue = comp.get("venue", {})
    return {
        "sport": "NCAAM",
        "espnId": ev["id"],
        "away": teams.get("away", "TBD"),
        "home": teams.get("home", "TBD"),
        "date": local.strftime("%Y-%m-%d"),
        "gameDateUTC": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "timeET": "TBD" if tbd else local.strftime("%-I:%M %p"),
        "startTimeTBD": tbd,
        "matchupTBD": "TBD" in teams.values(),
        "nationalTV": " / ".join(tv),
        "broadcasts": names,
        "round": "NCAAM",
        "seriesGame": notes[0] if notes else ("Conference" if conf else "Non-conference"),
        "series": "",
        "park": venue.get("fullName", ""),
        "neutralSite": bool(comp.get("neutralSite")),
        "result": "Final" if status.get("completed") else
                  ("Postponed" if "POSTPONED" in status.get("name", "") else
                   ("Cancelled" if "CANCELED" in status.get("name", "") else "Scheduled")),
        "ifNecessary": False,
        "doubleheader": "",
        "sortKey": f"{local:%Y-%m-%dT%H:%M}-cbb{ev['id']}",
        "updatedFromESPN": pulled,
    }


def main(start, end, out):
    os.makedirs(out, exist_ok=True)
    d, last = datetime.strptime(start, "%Y%m%d").date(), datetime.strptime(end, "%Y%m%d").date()
    pulled = datetime.now(ET).strftime("%Y-%m-%d %H:%M ET")
    kept = 0
    while d <= last:
        for ev in fetch(d):
            doc = to_doc(ev, pulled)
            if doc:
                with open(os.path.join(out, f"cbb{ev['id']}.json"), "w") as f:
                    json.dump(doc, f, indent=1)
                kept += 1
        d += timedelta(days=1)
    print(f"{kept} games written to {out}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
