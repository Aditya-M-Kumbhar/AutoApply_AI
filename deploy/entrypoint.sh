#!/bin/sh
set -eu
# Temporary on Render Free; persistent only if a volume is mounted elsewhere.
# The application runs as node in either case.
mkdir -p /data/resumes
chown node:node /data /data/resumes
exec gosu node "$@"
