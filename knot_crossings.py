"""Crossing-point and epsilon-margin geometry for the 2D knot diagram.

Reference implementation mirrored by `lib/knotCrossings.ts`.
"""

from __future__ import annotations

from math import hypot
from typing import Sequence

Point = tuple[float, float]
Segment = tuple[Point, Point]

_INTERIOR_EPS = 1e-6


def segment_intersection(a: Segment, b: Segment) -> tuple[Point, float, float] | None:
    """Proper interior intersection of two segments: (point, t_on_a, u_on_b)."""

    (ax, ay), (ax2, ay2) = a
    (bx, by), (bx2, by2) = b
    adx, ady = ax2 - ax, ay2 - ay
    bdx, bdy = bx2 - bx, by2 - by
    denom = adx * bdy - ady * bdx
    if abs(denom) < 1e-9:
        return None
    t = ((bx - ax) * bdy - (by - ay) * bdx) / denom
    u = ((bx - ax) * ady - (by - ay) * adx) / denom
    if not (_INTERIOR_EPS < t < 1 - _INTERIOR_EPS and _INTERIOR_EPS < u < 1 - _INTERIOR_EPS):
        return None
    return (ax + adx * t, ay + ady * t), t, u


def find_crossings(segments: Sequence[Segment]) -> list[dict[str, object]]:
    """All pairwise crossings with alternating over/under assignment."""

    found: list[dict[str, object]] = []
    for i in range(len(segments)):
        for j in range(i + 1, len(segments)):
            hit = segment_intersection(segments[i], segments[j])
            if hit is None:
                continue
            point, t, _ = hit
            (ax, ay), (ax2, ay2) = segments[i]
            (bx, by), (bx2, by2) = segments[j]
            sign = 1 if (ax2 - ax) * (by2 - by) - (ay2 - ay) * (bx2 - bx) > 0 else -1
            found.append({"point": point, "over": i, "under": j, "order": t, "sign": sign})
    for index, crossing in enumerate(found):
        rank = sum(
            1
            for other_index, other in enumerate(found)
            if other_index != index
            and (other["order"] < crossing["order"] or (other["order"] == crossing["order"] and other_index < index))
        )
        if rank % 2 == 1:
            crossing["over"], crossing["under"] = crossing["under"], crossing["over"]
            crossing["sign"] = -crossing["sign"]
    return found


def margin_square(segment: Segment, center: Point, epsilon: float) -> list[Point]:
    """Corners of the 2*epsilon-sided square gap aligned to the over line."""

    (x1, y1), (x2, y2) = segment
    length = hypot(x2 - x1, y2 - y1) or 1.0
    ux, uy = (x2 - x1) / length * epsilon, (y2 - y1) / length * epsilon
    cx, cy = center
    return [
        (cx - ux + uy, cy - uy - ux),
        (cx + ux + uy, cy + uy - ux),
        (cx + ux - uy, cy + uy + ux),
        (cx - ux - uy, cy - uy + ux),
    ]


def square_side(corners: Sequence[Point]) -> float:
    return hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1])


def writhe(crossings: Sequence[dict[str, object]]) -> int:
    return sum(int(c["sign"]) for c in crossings)


def margins_overlap(crossings: Sequence[dict[str, object]], epsilon: float) -> bool:
    """True when any two crossings are closer than 2*epsilon*sqrt(2)... i.e. their gaps could merge."""

    pts = [c["point"] for c in crossings]
    limit = 2 * epsilon * 2**0.5
    return any(
        hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < limit
        for i in range(len(pts))
        for j in range(i + 1, len(pts))
    )
