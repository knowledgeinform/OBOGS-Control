#!/bin/sh
#######################################################################################################################
## Copyright (C) 2019 The Johns Hopkins University Applied Physics Laboratory LLC (JHU-APL).  All Rights Reserved.
##
## This material may be only be used, modified, or reproduced by or for the U.S. Government pursuant to the license
## rights granted under the clauses at DFARS 252.227-7013#7014 or FAR 52.227-14. For any other permission, please
## contact the Office of Technology Transfer at JHU#APL: Telephone: 443-778-2792, Internet: www.jhuapl.edu/ott
##
## NO WARRANTY, NO LIABILITY. THIS MATERIAL IS PROVIDED "AS IS." JHU#APL MAKES NO REPRESENTATION OR WARRANTY WITH
## RESPECT TO THE PERFORMANCE OF THE MATERIALS, INCLUDING THEIR SAFETY, EFFECTIVENESS, OR COMMERCIAL VIABILITY, AND
## DISCLAIMS ALL WARRANTIES IN THE MATERIAL, WHETHER EXPRESS OR IMPLIED, INCLUDING (BUT NOT LIMITED TO) ANY AND ALL
## IMPLIED WARRANTIES OF PERFORMANCE, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT OF
## INTELLECTUAL PROPERTY OR OTHER THIRD PARTY RIGHTS. ANY USER OF THE MATERIAL ASSUMES THE ENTIRE RISK AND LIABILITY
## FOR USING THE MATERIAL. IN NO EVENT SHALL JHU-APL BE LIABLE TO ANY USER OF THE MATERIAL FOR ANY ACTUAL, INDIRECT,
## CONSEQUENTIAL, SPECIAL OR OTHER DAMAGES ARISING FROM THE USE OF, OR INABILITY TO USE, THE MATERIAL, INCLUDING,
## BUT NOT LIMITED TO, ANY DAMAGES FOR LOST PROFITS.
########################################################################################################################


# script that syncs current directory with pi directory over ssh
# IPADDR=169.254.23.127
IPADDR=DESKTOP-82U4VUG.local
# rsync -ravP -e ssh --delete ./ OBOGSNA1@${IPADDR}:/mnt/c/dev/obogs-control-master/obogs-control-master/ --exclude 'node_modules' --exclude 'config'
rsync -ravP -e ssh --delete jonesjp1@192.12.3.200:~/dev/NAVAIR/obogs-control/ ./ --exclude 'node_modules' --exclude 'config' --exclude '.git'

# rsync -ravP -e ssh --delete ./node_modules/alicat-mfc pi@${IPADDR}:~/sample-purification/node_modules/
