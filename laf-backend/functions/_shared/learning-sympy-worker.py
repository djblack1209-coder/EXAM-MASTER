"""One bounded SymPy reference, from rational coefficient arrays only. No raw expression evaluation."""
import json
import resource
import sys

resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
if sys.platform == "linux":
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))


def validate_polynomial(value):
    if not isinstance(value, list) or not 1 <= len(value) <= 7:
        raise ValueError("polynomial_limit")
    for pair in value:
        if (
            not isinstance(pair, list)
            or len(pair) != 2
            or any(type(n) is not int for n in pair)
            or abs(pair[0]) > 10**9
            or not 1 <= pair[1] <= 10**9
        ):
            raise ValueError("rational_limit")


def validate_expression(value):
    if not isinstance(value, dict) or set(value) != {"numerator", "denominator", "restrictions"}:
        raise ValueError("expression_shape")
    if not isinstance(value["restrictions"], list) or len(value["restrictions"]) > 16:
        raise ValueError("restriction_limit")
    for polynomial in [value["numerator"], value["denominator"], *value["restrictions"]]:
        validate_polynomial(polynomial)
    if any(all(pair[0] == 0 for pair in p) for p in [value["denominator"], *value["restrictions"]]):
        raise ValueError("undefined_expression")


raw = sys.stdin.buffer.read(16385)
if len(raw) > 16384:
    raise ValueError("input_limit")
r = json.loads(raw)
if (
    not isinstance(r, dict)
    or set(r) != {"left", "right", "domain"}
    or r["domain"] not in {"real", "positive", "integer"}
):
    raise ValueError("request_shape")
validate_expression(r["left"])
validate_expression(r["right"])

# Reject malformed requests before paying the optional runtime's import cost.
sys.path.insert(0, sys.argv[1])
from sympy import Poly, Rational, Symbol, __version__  # noqa: E402
import mpmath  # noqa: E402

if __version__ != "1.14.0" or mpmath.__version__ != "1.3.0":
    raise ValueError("upstream_version")
x = Symbol("x", real=True)


def polynomial(value):
    return Poly.from_list([Rational(pair[0], pair[1]) for pair in reversed(value)], gens=x)


def expression(value):
    return (
        polynomial(value["numerator"]),
        polynomial(value["denominator"]),
        [polynomial(p) for p in value["restrictions"]],
    )


a, b, ar = expression(r["left"])
c, d, cr = expression(r["right"])
numerator = a * d - c * b
if numerator.degree() > 6:
    raise ValueError("combined_degree_limit")
restrictions = [b, d] + ar + cr
if any(p.is_zero for p in restrictions):
    raise ValueError("undefined_expression")
excluded = set(v for p in restrictions if p.degree() > 0 for v in p.real_roots())
all_values = numerator.is_zero
roots = [] if all_values else list(set(numerator.real_roots()))


def allowed(v):
    return r["domain"] == "real" or (
        v.is_positive is True if r["domain"] == "positive" else v.is_integer is True
    )


result = {
    "upstream": "sympy",
    "version": __version__,
    "domain": r["domain"],
    "all": all_values,
    "solutions": sorted(str(v) for v in roots if allowed(v) and v not in excluded),
    "excluded": sorted(str(v) for v in excluded if allowed(v)),
    "gradingAuthority": False,
}
encoded = json.dumps(result)
if len(encoded.encode()) > 16384:
    raise ValueError("output_limit")
print(encoded)
