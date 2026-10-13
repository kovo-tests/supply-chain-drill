# Kovo drill canary

This is a Kovo security-drill fixture with no functionality. Do not use it in
applications. Versions are published only by the reviewed drill workflow.

The vulnerable and fixed labels are synthetic advisory subjects, not executable
vulnerabilities. The malicious label is also synthetic: that variant contains
only an inert postinstall script that writes `drill-marker.txt` under this
package's own directory. It does not access the network or read the environment,
and does not write outside the package. Other variants have no install scripts.
