.PHONY: app test demo
app:
	python3 run.py
test:
	python3 -m unittest discover -s tests -v
	node --test tests/*.mjs
demo:
	python3 -m scheduler solve examples/cohort_30_300.json --algorithm dsatur --output-dir output --slots-per-day 3 --skip-weekends --optimize-gaps
