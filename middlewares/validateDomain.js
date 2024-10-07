
module.exports = (req, res, next) => {
    const domain = req.headers['domain'];
    if (!domain) {
        return res.status(400).json({ message: 'Domain header is required' });
    }
    req.domain = domain;
    next();
};
