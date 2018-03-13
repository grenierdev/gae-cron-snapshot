"use strict";

const express = require('express');
const app = express();

const Compute = require('@google-cloud/compute');
const compute = new Compute();
// Disks : https://cloud.google.com/nodejs/docs/reference/compute/0.9.x/Compute#getDisksStream
// Snaps : https://cloud.google.com/nodejs/docs/reference/compute/0.9.x/Compute#getSnapshotsStream

app.get('/', (req, res) => {
	res.status(404).end();
});

function fetchDisks() {
	return new Promise((resolve, reject) => {
		const disks = [];

		try {
			compute.getDisksStream()
				.on('error', (err) => reject(err))
				.on('data', (disk) => {
					disks.push(disk);
				})
				.on('end', () => {
					resolve(disks);
				});
		} catch (err) {
			reject(err);
		}
	});
}

function fetchSnapshots(diskId) {
	return new Promise((resolve, reject) => {
		const snaps = [];

		try {
			compute.getSnapshotsStream({ filter: `sourceDiskId eq ${diskId}` })
				.on('error', (err) => reject(err))
				.on('data', (snap) => {
					snaps.push(snap);
				})
				.on('end', () => {
					resolve(snaps);
				});
		} catch (err) {
			reject(err);
		}
	});
}

app.get('/test', async (req, res) => {
	console.log(`Executing cron ${req.params.name}`);

	res.status(200).type('text/plain');

	const disks = await fetchDisks();

	for (let disk of disks) {
		const snaps = await fetchSnapshots(disk.metadata.id);

		res.write(`Disk ${disk.id} has ${snaps.length} snapshots : ${snaps.map(snap => snap.id).join(', ')}\n`);
		// TODO disk.createSnapshot(...) : https://cloud.google.com/compute/docs/reference/rest/v1/disks/createSnapshot
	}

	res.end();
});

app.get('/cron/:name', (req, res) => {
	console.log(`Executing cron ${req.params.name}`);
	res.status(200).send(`Cron ${req.params.name}`);
});

if (module === require.main) {
	const server = app.listen(process.env.PORT || 8080, () => {
		const port = server.address().port;
		console.log(`App listening on port ${port}.`);
	});
}

module.exports = app;