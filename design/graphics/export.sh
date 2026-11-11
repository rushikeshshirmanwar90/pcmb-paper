#!/usr/bin/env bash
# Exports every master to app-ready WebP (1x/2x/3x, light + dark) in assets/illustrations.
#   bash design/graphics/export.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
X=.claude/skills/pcmb-student-engagement/design/neobrutalism-expo/scripts/export_assets.py
PAL="#121212,#FFFFFF,#F7C744,#FCEDBE,#F49AD9,#86DE98,#BFA3FF,#8FD3FF"
still() { python3 "$X" still "design/graphics/masters/$1.png" --name "$1" --dp "$2" --out assets/illustrations --palette "$PAL" "${@:3}"; }
still welcome-hero 260x200 --dark
still empty-tests 170x140 --dark
still all-caught-up 170x140 --dark
still no-mistakes 170x140 --dark
still assessment-result 150x130 --dark
still offline 160x130 --dark
for s in physics chemistry maths biology; do still "subject-$s" 48x48 --dark --pad 0.02; done
# The faint pattern has its own hand-made dark master (cream doodles), no padding.
still pattern-doodles 400x220 --pad 0
still pattern-doodles-dark 400x220 --pad 0
