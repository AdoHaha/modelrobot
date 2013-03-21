f:
cd F:\Dropbox\modelrobot\coffee
set /P kofiname=Nazwa coffee (bez .coffee): %=%
coffee -o F:\Dropbox\modelrobot\scripts --watch --compile %kofiname%.coffee 
cd..