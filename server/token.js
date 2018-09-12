
class Token {
    /**
     * @param {string} access
     * @param {string} refresh
     */
    constructor(access, refresh = null) {
        const parts = access.split('.');

        if (parts.length < 3) {
            throw new Error('Invalid access token');
        }

        try {
            this.header = JSON.parse(this.decodeBase64(parts[0]));
        } catch (error) {
            throw new Error('Access token header is invalid');
        }

        try {
            this.payload = JSON.parse(this.decodeBase64(parts[1]));
        } catch (error) {
            throw new Error('Access token payload is invalid');
        }

        this.payload.iat = new Date(this.payload.iat * 1000);
        this.payload.nbf = new Date(this.payload.nbf * 1000);
        this.payload.exp = new Date(this.payload.exp * 1000);

        this.signature = parts[2];
        this.access = access;
        this.refresh = refresh;

        Object.freeze(this);
    }

    /**
     * @param {string} scope
     * @return {boolean}
     */
    isGranted(scope) {
        return this.payload.scopes.indexOf(scope) > -1;
    }

    /**
     * @return {boolean}
     */
    isExpired() {
        return this.payload.exp.getTime() <= Date.now();
    }

    /**
     * @return {boolean}
     */
    toString() {
        return this.access;
    }

    /**
     * Decode base64 string
     * @param {string}
     * @return {*}
     */
    decodeBase64(s) {
        var e={},i,b=0,c,x,l=0,a,r='',w=String.fromCharCode,L=s.length;
        var A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        for(i=0;i<64;i++){e[A.charAt(i)]=i;}
        for(x=0;x<L;x++){
            c=e[s.charAt(x)];b=(b<<6)+c;l+=6;
            while(l>=8){((a=(b>>>(l-=8))&0xff)||(x<(L-2)))&&(r+=w(a));}
        }
        return r;
    }
}

module.exports = Token;
